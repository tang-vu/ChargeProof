import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Contract, Interface, JsonRpcProvider, getAddress } from 'ethers';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const [sepoliaDeployment, creditcoinDeployment, evidence] = await Promise.all([
  readJson('deployments/sepolia.json'),
  readJson('deployments/creditcoin-testnet.json'),
  readJson('deployments/gate2-evidence.json'),
]);

assert.equal(sepoliaDeployment.status, 'deployed');
assert.equal(creditcoinDeployment.status, 'deployed');
assert.equal(evidence.status, 'complete');

const sepolia = new JsonRpcProvider(
  process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com',
  11_155_111,
  { staticNetwork: true },
);
const creditcoin = new JsonRpcProvider(
  process.env.CREDITCOIN_TESTNET_RPC_URL ?? 'https://rpc.cc3-testnet.creditcoin.network',
  102_031,
  { staticNetwork: true },
);

const sourceRegistry = getAddress(sepoliaDeployment.contracts.chargingSessionRegistry);
const verifierAddress = getAddress(creditcoinDeployment.contracts.attestcoinChargeVerifier);
const driver = getAddress(evidence.driver);

await Promise.all([
  assertChain(sepolia, 11_155_111, 'Sepolia'),
  assertChain(creditcoin, 102_031, 'Creditcoin Testnet'),
  assertCode(sepolia, sourceRegistry),
  ...Object.values(creditcoinDeployment.contracts).map((address) =>
    assertCode(creditcoin, getAddress(address)),
  ),
]);

await Promise.all([
  ...Object.values(sepoliaDeployment.transactions).map((hash) =>
    assertReceipt(sepolia, hash, 1, 'Sepolia deployment'),
  ),
  ...Object.values(creditcoinDeployment.transactions).map((hash) =>
    assertReceipt(creditcoin, hash, 1, 'Creditcoin deployment'),
  ),
]);

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
  sepolia.getTransaction(evidence.transactions.source),
  creditcoin.getTransaction(evidence.transactions.settlement),
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

const [station, intent, claimable, sessionProcessed] = await Promise.all([
  stationRegistry.station(creditcoinDeployment.station.stationId),
  escrow.intent(evidence.intentId),
  escrow.claimable(driver),
  verifier.processedSessions(evidence.sessionId),
]);

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

async function assertChain(provider, expected, label) {
  const network = await provider.getNetwork();
  assert.equal(network.chainId, BigInt(expected), `${label} chain ID mismatch`);
}

async function assertCode(provider, address) {
  const code = await provider.getCode(address);
  assert.notEqual(code, '0x', `no runtime code at ${address}`);
}

async function assertReceipt(provider, hash, expectedStatus, label) {
  const receipt = await provider.getTransactionReceipt(hash);
  assert(receipt, `${label} receipt is unavailable: ${hash}`);
  assert.equal(receipt.status, expectedStatus, `${label} status mismatch: ${hash}`);
  return receipt;
}
