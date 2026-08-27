import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Contract, FallbackProvider, FetchRequest, Interface, JsonRpcProvider, getAddress } from 'ethers';

const RPC_ATTEMPTS = 3;
const RPC_TIMEOUT_MS = 15_000;

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const [sepoliaDeployment, creditcoinDeployment, evidence] = await Promise.all([
  readJson('deployments/sepolia.json'),
  readJson('deployments/creditcoin-testnet.json'),
  readJson('deployments/gate2-evidence.json'),
]);

assert.equal(sepoliaDeployment.status, 'deployed');
assert.equal(creditcoinDeployment.status, 'deployed');
assert.equal(evidence.status, 'complete');

const sepolia = createProvider(
  process.env.SEPOLIA_RPC_URL
    ? [process.env.SEPOLIA_RPC_URL]
    : ['https://ethereum-sepolia-rpc.publicnode.com'],
  11_155_111,
);
const creditcoin = createProvider(
  process.env.CREDITCOIN_TESTNET_RPC_URL
    ? [process.env.CREDITCOIN_TESTNET_RPC_URL]
    : ['https://rpc.cc3-testnet.creditcoin.network', 'https://creditcoin-testnet.blockscout.com/api/eth-rpc'],
  102_031,
);

const sourceRegistry = getAddress(sepoliaDeployment.contracts.chargingSessionRegistry);
const verifierAddress = getAddress(creditcoinDeployment.contracts.attestcoinChargeVerifier);
const driver = getAddress(evidence.driver);

await assertChain(sepolia, 11_155_111, 'Sepolia');
await assertChain(creditcoin, 102_031, 'Creditcoin Testnet');
await assertCode(sepolia, sourceRegistry);
for (const address of Object.values(creditcoinDeployment.contracts)) {
  await assertCode(creditcoin, getAddress(address));
}

for (const hash of Object.values(sepoliaDeployment.transactions)) {
  await assertReceipt(sepolia, hash, 1, 'Sepolia deployment');
}
for (const hash of Object.values(creditcoinDeployment.transactions)) {
  await assertReceipt(creditcoin, hash, 1, 'Creditcoin deployment');
}

const [
  intentReceipt,
  sourceReceipt,
  settlementReceipt,
  replayReceipt,
  sourceTransaction,
  settlementTransaction,
] = await Promise.all([
  assertReceipt(creditcoin, evidence.transactions.intent, 1, 'intent'),
  assertReceipt(sepolia, evidence.transactions.source, 1, 'source receipt'),
  assertReceipt(creditcoin, evidence.transactions.settlement, 1, 'settlement'),
  assertReceipt(creditcoin, evidence.transactions.replay, 0, 'replay'),
  retryRpc('source transaction', () => sepolia.getTransaction(evidence.transactions.source)),
  retryRpc('settlement transaction', () => creditcoin.getTransaction(evidence.transactions.settlement)),
]);

assert.equal(getAddress(intentReceipt.from), driver, 'intent driver mismatch');
assert.equal(getAddress(sourceReceipt.from), driver, 'source driver mismatch');
assert.equal(getAddress(sourceReceipt.to), sourceRegistry, 'source registry mismatch');
assert.equal(getAddress(settlementReceipt.to), verifierAddress, 'settlement verifier mismatch');
assert.equal(getAddress(replayReceipt.to), verifierAddress, 'replay verifier mismatch');
assert(sourceTransaction, 'source transaction is unavailable');
assert(settlementTransaction, 'settlement transaction is unavailable');

const sourceInterface = new Interface([
  'function finalizeSession((bytes32 intentId,bytes32 sessionId,bytes32 stationId,address driver,uint64 startedAt,uint64 endedAt,uint64 energyWh,uint256 tariff,uint256 finalAmount,uint64 nonce),bytes deviceSignature)',
]);
const verifierInterface = new Interface([
  'function verifyAndSettle((uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,(bytes32 hash,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots))',
]);
assert.equal(sourceTransaction.data.slice(0, 10), sourceInterface.getFunction('finalizeSession').selector);
assert.equal(
  settlementTransaction.data.slice(0, 10),
  verifierInterface.getFunction('verifyAndSettle').selector,
);

const stationRegistry = new Contract(
  creditcoinDeployment.contracts.stationRegistry,
  [
    'function station(bytes32) view returns ((address payout,address deviceSigner,bool active,string metadataURI,uint64 completedSessions,uint64 successfulSettlements,uint256 totalEnergyWh,uint256 totalValueSettled))',
  ],
  creditcoin,
);
const escrow = new Contract(
  creditcoinDeployment.contracts.chargeIntentEscrow,
  [
    'function intent(bytes32) view returns ((address driver,bytes32 stationId,address stationPayout,address deviceSigner,uint256 maxPayment,uint256 tariff,uint64 openedAt,uint64 expiresAt,uint64 sourceChainKey,address sourceRegistry,uint8 state,uint256 paidAmount,uint256 refundAmount,bytes32 sourceTransactionKey,bytes32 sessionId))',
    'function claimable(address) view returns (uint256)',
  ],
  creditcoin,
);
const verifier = new Contract(
  verifierAddress,
  ['function processedSessions(bytes32) view returns (bool)'],
  creditcoin,
);

const station = await retryRpc('station metrics', () =>
  stationRegistry.station(creditcoinDeployment.station.stationId),
);
const intent = await retryRpc('settled intent', () => escrow.intent(evidence.intentId));
const claimable = await retryRpc('claimable accounting', () => escrow.claimable(driver));
const sessionProcessed = await retryRpc('session replay marker', () =>
  verifier.processedSessions(evidence.sessionId),
);

assert.equal(intent.state, 2n, 'intent is not settled');
assert.equal(intent.paidAmount.toString(), evidence.settlement.stationPayment);
assert.equal(intent.refundAmount.toString(), evidence.settlement.driverRefund);
assert.equal(intent.sessionId.toLowerCase(), evidence.sessionId.toLowerCase());
assert.equal(station.completedSessions.toString(), evidence.settlement.completedSessions);
assert.equal(station.successfulSettlements.toString(), evidence.settlement.successfulSettlements);
assert.equal(station.totalEnergyWh.toString(), evidence.settlement.totalEnergyWh);
assert.equal(station.totalValueSettled.toString(), evidence.settlement.totalValueSettled);
assert.equal(claimable.toString(), evidence.settlement.combinedClaimableAtDemoAddress);
assert.equal(sessionProcessed, true, 'session replay marker is not set');

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      sourceBlockNumber: sourceReceipt.blockNumber,
      settlementBlockNumber: settlementReceipt.blockNumber,
      replayBlockNumber: replayReceipt.blockNumber,
      sourceStatus: sourceReceipt.status,
      settlementStatus: settlementReceipt.status,
      replayStatus: replayReceipt.status,
      runtimeContractsVerified: 5,
      intentState: 'Settled',
      sessionReplayMarker: sessionProcessed,
      completedSessions: station.completedSessions.toString(),
      totalEnergyWh: station.totalEnergyWh.toString(),
      totalValueSettled: station.totalValueSettled.toString(),
    },
    null,
    2,
  )}\n`,
);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(repositoryRoot, relativePath), 'utf8'));
}

function createProvider(urls, chainId) {
  const providers = urls.map((url, index) => {
    const request = new FetchRequest(url);
    request.timeout = RPC_TIMEOUT_MS;
    return {
      provider: new JsonRpcProvider(request, chainId, { staticNetwork: true }),
      priority: index + 1,
      stallTimeout: 2_000,
      weight: 1,
    };
  });
  if (providers.length === 1) return providers[0].provider;
  return new FallbackProvider(providers, chainId, { quorum: 1 });
}

async function retryRpc(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= RPC_ATTEMPTS; attempt += 1) {
    try {
      const result = await operation();
      if (result === null || result === undefined) throw new Error(`${label} is unavailable`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === RPC_ATTEMPTS) break;
      process.stderr.write(`RPC retry ${attempt}/${RPC_ATTEMPTS - 1}: ${label}\n`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`${label} failed after ${RPC_ATTEMPTS} attempts`, { cause: lastError });
}

async function assertChain(provider, expected, label) {
  const network = await retryRpc(`${label} chain ID`, () => provider.getNetwork());
  assert.equal(network.chainId, BigInt(expected), `${label} chain ID mismatch`);
}

async function assertCode(provider, address) {
  const code = await retryRpc(`runtime code at ${address}`, () => provider.getCode(address));
  assert.notEqual(code, '0x', `no runtime code at ${address}`);
}

async function assertReceipt(provider, hash, expectedStatus, label) {
  const receipt = await retryRpc(label, () => provider.getTransactionReceipt(hash));
  assert(receipt, `${label} receipt is unavailable: ${hash}`);
  assert.equal(receipt.status, expectedStatus, `${label} status mismatch: ${hash}`);
  return receipt;
}
