#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { config as loadEnvironment } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  isHex,
  keccak256,
  parseAbi,
  size,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { z } from 'zod';

import {
  ATTESTCOIN_PROVER_URL,
  CREDITCOIN_TESTNET_EXPLORER,
  CREDITCOIN_TESTNET_RPC,
  DEFAULT_SEPOLIA_RPC,
  DEMO_MAX_PAYMENT,
  DEMO_STATION_ID,
  DEMO_TARGET_ENERGY_WH,
  DEMO_TARIFF,
  SEPOLIA_ATTESTCOIN_CHAIN_KEY,
  SEPOLIA_EXPLORER,
  attestcoinChargeVerifierAbi,
  calculateFinalAmount,
  calculateSessionId,
  chargeIntentEscrowAbi,
  chargingSessionRegistryAbi,
  creditcoinTestnet,
  deviceReceiptTypedData,
  mockUsdcAbi,
  proofContractArguments,
  stationRegistryAbi,
  type AttestcoinProofData,
  type ChargingReceipt,
} from '@chargeproof/shared';

import { LiveAttestationPorts } from './live-ports.js';
import { FileStateStore } from './state-store.js';
import { submitReadyProof } from './submit.js';
import { AttestationWorker } from './worker.js';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const stateDirectory = path.resolve(repositoryRoot, 'worker-state');
const gate2StatePath = path.resolve(stateDirectory, 'gate2.json');
const evidencePath = path.resolve(repositoryRoot, 'deployments/gate2-evidence.json');

loadEnvironment({ path: path.resolve(repositoryRoot, '.env'), quiet: true });

const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().refine(isAddress);
const decimalSchema = z.string().regex(/^\d+$/);
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);

const receiptStateSchema = z.object({
  intentId: hashSchema,
  sessionId: hashSchema,
  stationId: hashSchema,
  driver: addressSchema,
  startedAt: decimalSchema,
  endedAt: decimalSchema,
  energyWh: decimalSchema,
  tariff: decimalSchema,
  finalAmount: decimalSchema,
  nonce: decimalSchema,
  deviceSignature: hexSchema,
});

const gate2StateSchema = z.object({
  schemaVersion: z.literal(1),
  phase: z.enum([
    'PREPARED',
    'TOKEN_READY',
    'INTENT_OPENED',
    'SOURCE_MINED',
    'PROOF_READY',
    'SETTLED',
    'COMPLETE',
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  driver: addressSchema,
  deviceSigner: addressSchema,
  intentId: hashSchema,
  nonce: decimalSchema,
  expiresAt: decimalSchema,
  faucetTransactionHash: hashSchema.optional(),
  approvalTransactionHash: hashSchema.optional(),
  intentTransactionHash: hashSchema.optional(),
  receipt: receiptStateSchema.optional(),
  sourceTransactionHash: hashSchema.optional(),
  sourceBlockNumber: z.number().int().nonnegative().optional(),
  settlementTransactionHash: hashSchema.optional(),
  settlementBlockNumber: z.number().int().nonnegative().optional(),
  replayTransactionHash: hashSchema.optional(),
  replayBlockNumber: z.number().int().nonnegative().optional(),
});

type Gate2State = z.infer<typeof gate2StateSchema>;

const sepoliaDeploymentSchema = z.object({
  status: z.literal('deployed'),
  chainId: z.literal(11_155_111),
  contracts: z.object({ chargingSessionRegistry: addressSchema }),
  station: z.object({ stationId: hashSchema, deviceSigner: addressSchema }),
});

const creditcoinDeploymentSchema = z.object({
  status: z.literal('deployed'),
  chainId: z.literal(102_031),
  contracts: z.object({
    mockUsdc: addressSchema,
    stationRegistry: addressSchema,
    chargeIntentEscrow: addressSchema,
    attestcoinChargeVerifier: addressSchema,
  }),
  attestcoin: z.object({
    sourceChainKey: z.literal(1),
    sourceRegistry: addressSchema,
  }),
  station: z.object({ stationId: hashSchema, payout: addressSchema, deviceSigner: addressSchema }),
});

const tokenReadAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
]);

const escrowReadAbi = parseAbi(['function claimable(address account) view returns (uint256)']);

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const sepoliaDeployment = sepoliaDeploymentSchema.parse(
    JSON.parse(await readFile(path.resolve(repositoryRoot, 'deployments/sepolia.json'), 'utf8')),
  );
  const creditcoinDeployment = creditcoinDeploymentSchema.parse(
    JSON.parse(await readFile(path.resolve(repositoryRoot, 'deployments/creditcoin-testnet.json'), 'utf8')),
  );

  const driverKey = requiredPrivateKey('CREDITCOIN_DEPLOYER_PRIVATE_KEY');
  const sepoliaKey = requiredPrivateKey('SEPOLIA_DEPLOYER_PRIVATE_KEY');
  const deviceKey = requiredPrivateKey('DEVICE_SIMULATOR_PRIVATE_KEY');
  const driverAccount = privateKeyToAccount(driverKey);
  const sepoliaAccount = privateKeyToAccount(sepoliaKey);
  const deviceAccount = privateKeyToAccount(deviceKey);

  if (driverAccount.address !== sepoliaAccount.address) {
    throw new Error('Gate 2 requires the same dedicated driver on Creditcoin and Sepolia');
  }
  if (
    getAddress(deviceAccount.address) !== getAddress(sepoliaDeployment.station.deviceSigner) ||
    getAddress(deviceAccount.address) !== getAddress(creditcoinDeployment.station.deviceSigner)
  ) {
    throw new Error('The local device key does not match both deployed station configurations');
  }
  if (
    getAddress(sepoliaDeployment.contracts.chargingSessionRegistry) !==
    getAddress(creditcoinDeployment.attestcoin.sourceRegistry)
  ) {
    throw new Error('Creditcoin verifier is not bound to the deployed Sepolia registry');
  }
  if (
    sepoliaDeployment.station.stationId.toLowerCase() !== DEMO_STATION_ID.toLowerCase() ||
    creditcoinDeployment.station.stationId.toLowerCase() !== DEMO_STATION_ID.toLowerCase()
  ) {
    throw new Error('Deployment metadata does not describe the canonical demo station');
  }

  const sepoliaRpc = process.env.SEPOLIA_RPC_URL ?? DEFAULT_SEPOLIA_RPC;
  const creditcoinRpc = process.env.CREDITCOIN_TESTNET_RPC_URL ?? CREDITCOIN_TESTNET_RPC;
  const sepoliaPublic = createPublicClient({ chain: sepolia, transport: http(sepoliaRpc) });
  const creditcoinPublic = createPublicClient({
    chain: creditcoinTestnet,
    transport: http(creditcoinRpc),
  });
  const sepoliaWallet = createWalletClient({
    account: sepoliaAccount,
    chain: sepolia,
    transport: http(sepoliaRpc),
  });
  const creditcoinWallet = createWalletClient({
    account: driverAccount,
    chain: creditcoinTestnet,
    transport: http(creditcoinRpc),
  });

  await assertRuntimeCode(sepoliaPublic, [sepoliaDeployment.contracts.chargingSessionRegistry]);
  await assertRuntimeCode(creditcoinPublic, Object.values(creditcoinDeployment.contracts));

  let gate2 =
    (await readGate2State()) ?? (await createGate2State(driverAccount.address, deviceAccount.address));
  if (getAddress(gate2.driver) !== getAddress(driverAccount.address)) {
    throw new Error('Persisted Gate 2 state belongs to a different driver');
  }
  if (getAddress(gate2.deviceSigner) !== getAddress(deviceAccount.address)) {
    throw new Error('Persisted Gate 2 state belongs to a different device signer');
  }

  const updateGate2 = async (patch: Partial<Gate2State>): Promise<void> => {
    gate2 = gate2StateSchema.parse({
      ...gate2,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await writeJsonAtomic(gate2StatePath, gate2, 0o600);
  };

  const token = getAddress(creditcoinDeployment.contracts.mockUsdc);
  const escrow = getAddress(creditcoinDeployment.contracts.chargeIntentEscrow);
  const verifier = getAddress(creditcoinDeployment.contracts.attestcoinChargeVerifier);
  const stationRegistry = getAddress(creditcoinDeployment.contracts.stationRegistry);
  const sourceRegistry = getAddress(sepoliaDeployment.contracts.chargingSessionRegistry);

  let tokenBalance = await creditcoinPublic.readContract({
    address: token,
    abi: tokenReadAbi,
    functionName: 'balanceOf',
    args: [driverAccount.address],
  });
  if (tokenBalance < DEMO_MAX_PAYMENT) {
    let faucetHash = gate2.faucetTransactionHash as Hex | undefined;
    if (!faucetHash) {
      faucetHash = await creditcoinWallet.writeContract({
        account: driverAccount,
        address: token,
        abi: mockUsdcAbi,
        functionName: 'faucet',
      });
      await updateGate2({ faucetTransactionHash: faucetHash });
    }
    await requireSuccess(creditcoinPublic, faucetHash, 'MockUSDC faucet');
    tokenBalance = await creditcoinPublic.readContract({
      address: token,
      abi: tokenReadAbi,
      functionName: 'balanceOf',
      args: [driverAccount.address],
    });
  }
  if (tokenBalance < DEMO_MAX_PAYMENT) throw new Error('MockUSDC faucet balance is insufficient');

  const allowance = await creditcoinPublic.readContract({
    address: token,
    abi: tokenReadAbi,
    functionName: 'allowance',
    args: [driverAccount.address, escrow],
  });
  if (allowance < DEMO_MAX_PAYMENT) {
    let approvalHash = gate2.approvalTransactionHash as Hex | undefined;
    if (!approvalHash) {
      approvalHash = await creditcoinWallet.writeContract({
        account: driverAccount,
        address: token,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [escrow, DEMO_MAX_PAYMENT],
      });
      await updateGate2({ approvalTransactionHash: approvalHash });
    }
    await requireSuccess(creditcoinPublic, approvalHash, 'MockUSDC approval');
  }
  await updateGate2({ phase: 'TOKEN_READY' });

  let intentHash = gate2.intentTransactionHash as Hex | undefined;
  if (!intentHash) {
    const latestCreditcoinBlock = await creditcoinPublic.getBlock();
    if (BigInt(gate2.expiresAt) < latestCreditcoinBlock.timestamp + 600n) {
      throw new Error('Persisted intent expiry is stale before submission; archive gate2 state and rerun');
    }
    intentHash = await creditcoinWallet.writeContract({
      account: driverAccount,
      address: escrow,
      abi: chargeIntentEscrowAbi,
      functionName: 'openIntent',
      args: [
        gate2.intentId as Hex,
        DEMO_STATION_ID,
        DEMO_MAX_PAYMENT,
        DEMO_TARIFF,
        BigInt(gate2.expiresAt),
        BigInt(SEPOLIA_ATTESTCOIN_CHAIN_KEY),
        sourceRegistry,
      ],
    });
    await updateGate2({ intentTransactionHash: intentHash });
  }
  const intentReceipt = await requireSuccess(creditcoinPublic, intentHash, 'charging intent');
  await updateGate2({ phase: 'INTENT_OPENED' });

  let receipt = gate2.receipt ? receiptFromState(gate2.receipt) : undefined;
  if (!receipt) {
    const [intentBlock, latestSourceBlock] = await Promise.all([
      creditcoinPublic.getBlock({ blockNumber: intentReceipt.blockNumber }),
      sepoliaPublic.getBlock(),
    ]);
    if (intentBlock.timestamp > latestSourceBlock.timestamp + 300n) {
      throw new Error('Creditcoin clock is too far ahead of Sepolia to create a safe receipt');
    }
    const startedAt = intentBlock.timestamp;
    const endedAt = latestSourceBlock.timestamp > startedAt ? latestSourceBlock.timestamp : startedAt;
    if (endedAt > BigInt(gate2.expiresAt)) throw new Error('Charging receipt would end after intent expiry');
    const nonce = BigInt(gate2.nonce);
    const finalAmount = calculateFinalAmount(DEMO_TARGET_ENERGY_WH, DEMO_TARIFF);
    receipt = {
      intentId: gate2.intentId as Hex,
      sessionId: calculateSessionId(
        gate2.intentId as Hex,
        DEMO_STATION_ID,
        driverAccount.address,
        startedAt,
        nonce,
      ),
      stationId: DEMO_STATION_ID,
      driver: driverAccount.address,
      startedAt,
      endedAt,
      energyWh: DEMO_TARGET_ENERGY_WH,
      tariff: DEMO_TARIFF,
      finalAmount,
      nonce,
    };
    const deviceSignature = await deviceAccount.signTypedData(
      deviceReceiptTypedData(sourceRegistry, receipt),
    );
    await updateGate2({ receipt: receiptToState(receipt, deviceSignature) });
  }
  const deviceSignature = gate2.receipt?.deviceSignature as Hex | undefined;
  if (!deviceSignature) throw new Error('Persisted receipt signature is unavailable');

  let sourceHash = gate2.sourceTransactionHash as Hex | undefined;
  if (!sourceHash) {
    sourceHash = await sepoliaWallet.writeContract({
      account: sepoliaAccount,
      address: sourceRegistry,
      abi: chargingSessionRegistryAbi,
      functionName: 'finalizeSession',
      args: [receipt, deviceSignature],
    });
    await updateGate2({ sourceTransactionHash: sourceHash });
  }
  const sourceReceipt = await requireSuccess(sepoliaPublic, sourceHash, 'Sepolia charging receipt');
  await updateGate2({ phase: 'SOURCE_MINED', sourceBlockNumber: Number(sourceReceipt.blockNumber) });

  const proofStore = new FileStateStore(stateDirectory);
  const worker = new AttestationWorker(
    new LiveAttestationPorts({
      sourceRpcUrl: sepoliaRpc,
      creditcoinRpcUrl: creditcoinRpc,
      proofBuilderUrl: process.env.ATTESTCOIN_PROVER_URL ?? ATTESTCOIN_PROVER_URL,
    }),
    proofStore,
    { expectedSourceRegistry: sourceRegistry },
  );
  const deadline = Date.now() + timeoutMinutes() * 60_000;
  let workerState = await worker.step(sourceHash);
  while (
    !['PROOF_READY', 'SUBMITTED', 'SETTLED', 'FAILED'].includes(workerState.phase) &&
    Date.now() < deadline
  ) {
    printProgress(workerState);
    await delay(15_000);
    workerState = await worker.step(sourceHash);
  }
  if (workerState.phase === 'FAILED') {
    throw new Error(workerState.lastError?.message ?? 'Attestation worker failed permanently');
  }
  if (!workerState.proof || !workerState.precompileVerified) {
    throw new Error('Attestation is still pending; rerun pnpm gate2:run to resume by source hash');
  }
  await updateGate2({ phase: 'PROOF_READY' });

  workerState = await submitReadyProof({
    state: workerState,
    store: proofStore,
    rpcUrl: creditcoinRpc,
    verifierAddress: verifier,
    privateKey: process.env.CREDITCOIN_SETTLER_PRIVATE_KEY ?? driverKey,
  });
  const settledProof = workerState.proof;
  if (!workerState.settlementTransactionHash || workerState.phase !== 'SETTLED' || !settledProof) {
    throw new Error('Settlement did not reach the terminal SETTLED phase');
  }
  await updateGate2({
    phase: 'SETTLED',
    settlementTransactionHash: workerState.settlementTransactionHash,
    settlementBlockNumber: workerState.settlementBlockNumber,
  });

  const proofArgument = proofContractArguments(normalizeProof(settledProof));
  let replayHash = gate2.replayTransactionHash as Hex | undefined;
  if (!replayHash) {
    replayHash = await creditcoinWallet.sendTransaction({
      account: driverAccount,
      to: verifier,
      data: encodeFunctionData({
        abi: attestcoinChargeVerifierAbi,
        functionName: 'verifyAndSettle',
        args: [proofArgument],
      }),
      gas: 1_000_000n,
    });
    await updateGate2({ replayTransactionHash: replayHash });
  }
  const replayReceipt = await creditcoinPublic.waitForTransactionReceipt({ hash: replayHash });
  if (replayReceipt.status !== 'reverted') {
    throw new Error('Replay transaction unexpectedly succeeded');
  }
  await updateGate2({ phase: 'COMPLETE', replayBlockNumber: Number(replayReceipt.blockNumber) });

  const [station, combinedClaimable] = await Promise.all([
    creditcoinPublic.readContract({
      address: stationRegistry,
      abi: stationRegistryAbi,
      functionName: 'station',
      args: [DEMO_STATION_ID],
    }),
    creditcoinPublic.readContract({
      address: escrow,
      abi: escrowReadAbi,
      functionName: 'claimable',
      args: [driverAccount.address],
    }),
  ]);
  const finalAmount = receipt.finalAmount;
  const evidence = {
    schemaVersion: 1,
    project: 'ChargeProof',
    status: 'complete',
    generatedAt: new Date().toISOString(),
    driver: driverAccount.address,
    deviceSigner: deviceAccount.address,
    intentId: gate2.intentId,
    sessionId: receipt.sessionId,
    contracts: {
      sepoliaRegistry: sourceRegistry,
      mockUsdc: token,
      stationRegistry,
      escrow,
      verifier,
    },
    transactions: {
      faucet: gate2.faucetTransactionHash,
      approval: gate2.approvalTransactionHash,
      intent: intentHash,
      source: sourceHash,
      settlement: workerState.settlementTransactionHash,
      replay: replayHash,
    },
    explorers: {
      intent: `${CREDITCOIN_TESTNET_EXPLORER}/tx/${intentHash}`,
      source: `${SEPOLIA_EXPLORER}/tx/${sourceHash}`,
      settlement: `${CREDITCOIN_TESTNET_EXPLORER}/tx/${workerState.settlementTransactionHash}`,
      replay: `${CREDITCOIN_TESTNET_EXPLORER}/tx/${replayHash}`,
    },
    proof: {
      sourceBlockNumber: workerState.blockNumber,
      transactionIndex: workerState.transactionIndex,
      encodedTransactionBytes: (settledProof.txBytes.length - 2) / 2,
      merkleSiblingCount: settledProof.merkleProof.siblings.length,
      continuityRootCount: settledProof.continuityProof.roots.length,
      precompileVerified: workerState.precompileVerified,
    },
    settlement: {
      energyWh: receipt.energyWh.toString(),
      maxPayment: DEMO_MAX_PAYMENT.toString(),
      stationPayment: finalAmount.toString(),
      driverRefund: (DEMO_MAX_PAYMENT - finalAmount).toString(),
      combinedClaimableAtDemoAddress: combinedClaimable.toString(),
      completedSessions: station.completedSessions.toString(),
      successfulSettlements: station.successfulSettlements.toString(),
      totalEnergyWh: station.totalEnergyWh.toString(),
      totalValueSettled: station.totalValueSettled.toString(),
    },
    replay: { expected: 'reverted', observed: replayReceipt.status },
  };
  await writeJsonAtomic(evidencePath, evidence, 0o644);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

async function createGate2State(driver: Address, deviceSigner: Address): Promise<Gate2State> {
  const timestamp = new Date();
  const entropy = randomBytes(16).toString('hex');
  const intentId = keccak256(
    stringToHex(`ChargeProof Gate2:${driver}:${timestamp.toISOString()}:${entropy}`),
  );
  const nonceBytes = randomBytes(8);
  const nonce = BigInt(`0x${nonceBytes.toString('hex')}`) || 1n;
  const state = gate2StateSchema.parse({
    schemaVersion: 1,
    phase: 'PREPARED',
    createdAt: timestamp.toISOString(),
    updatedAt: timestamp.toISOString(),
    driver,
    deviceSigner,
    intentId,
    nonce: nonce.toString(),
    expiresAt: (BigInt(Math.floor(timestamp.getTime() / 1_000)) + 7n * 24n * 60n * 60n).toString(),
  });
  await writeJsonAtomic(gate2StatePath, state, 0o600);
  return state;
}

async function readGate2State(): Promise<Gate2State | undefined> {
  try {
    return gate2StateSchema.parse(JSON.parse(await readFile(gate2StatePath, 'utf8')));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function receiptToState(receipt: ChargingReceipt, deviceSignature: Hex) {
  return {
    intentId: receipt.intentId,
    sessionId: receipt.sessionId,
    stationId: receipt.stationId,
    driver: receipt.driver,
    startedAt: receipt.startedAt.toString(),
    endedAt: receipt.endedAt.toString(),
    energyWh: receipt.energyWh.toString(),
    tariff: receipt.tariff.toString(),
    finalAmount: receipt.finalAmount.toString(),
    nonce: receipt.nonce.toString(),
    deviceSignature,
  };
}

function receiptFromState(stored: z.infer<typeof receiptStateSchema>): ChargingReceipt {
  return {
    intentId: stored.intentId as Hex,
    sessionId: stored.sessionId as Hex,
    stationId: stored.stationId as Hex,
    driver: getAddress(stored.driver),
    startedAt: BigInt(stored.startedAt),
    endedAt: BigInt(stored.endedAt),
    energyWh: BigInt(stored.energyWh),
    tariff: BigInt(stored.tariff),
    finalAmount: BigInt(stored.finalAmount),
    nonce: BigInt(stored.nonce),
  };
}

function normalizeProof(proof: NonNullable<Awaited<ReturnType<AttestationWorker['step']>>['proof']>) {
  return {
    ...proof,
    txHash: proof.txHash as Hex,
    txBytes: proof.txBytes as Hex,
    merkleProof: {
      root: proof.merkleProof.root as Hex,
      siblings: proof.merkleProof.siblings.map((sibling) => ({
        hash: sibling.hash as Hex,
        isLeft: sibling.isLeft,
      })),
    },
    continuityProof: {
      lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest as Hex,
      roots: proof.continuityProof.roots as Hex[],
    },
  } satisfies AttestcoinProofData;
}

async function requireSuccess(client: ReturnType<typeof createPublicClient>, hash: Hex, label: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${label} transaction reverted`);
  return receipt;
}

async function assertRuntimeCode(
  client: ReturnType<typeof createPublicClient>,
  addresses: string[],
): Promise<void> {
  for (const value of addresses) {
    const address = getAddress(value);
    const code = await client.getCode({ address });
    if (!code || code === '0x') throw new Error(`No runtime bytecode at ${address}`);
  }
}

function requiredPrivateKey(name: string): Hex {
  const value = process.env[name];
  if (!value || !isHex(value) || size(value) !== 32) {
    throw new Error(`${name} must be a 32-byte dedicated testnet key`);
  }
  return value;
}

function timeoutMinutes(): number {
  const parsed = Number(process.env.GATE2_TIMEOUT_MINUTES ?? '60');
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
    throw new Error('GATE2_TIMEOUT_MINUTES must be between 1 and 120');
  }
  return parsed;
}

function printProgress(state: Awaited<ReturnType<AttestationWorker['step']>>): void {
  process.stdout.write(
    `${JSON.stringify({
      phase: state.phase,
      sourceBlockNumber: state.blockNumber,
      latestOnchainAttestedHeight: state.latestOnchainAttestedHeight,
      latestProverAttestedHeight: state.latestProverAttestedHeight,
      lastError: state.lastError,
    })}\n`,
  );
}

async function writeJsonAtomic(destination: string, value: unknown, mode: number): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode,
  });
  await rename(temporary, destination);
}
