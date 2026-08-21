#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import 'dotenv/config';

import { ATTESTCOIN_PROVER_URL, CREDITCOIN_TESTNET_RPC, DEFAULT_SEPOLIA_RPC } from '@chargeproof/shared';

import { LiveAttestationPorts } from './live-ports.js';
import { FileStateStore } from './state-store.js';
import { submitReadyProof } from './submit.js';
import { AttestationWorker } from './worker.js';

const [command, transactionHash, ...flags] = process.argv.slice(2);

if (!command || !transactionHash || !['inspect', 'resume', 'submit'].includes(command)) {
  usage();
  process.exitCode = 1;
} else {
  await main(command, transactionHash, flags).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    process.exitCode = 1;
  });
}

async function main(command: string, transactionHash: string, flags: string[]): Promise<void> {
  const stateDirectory = process.env.ATTESTATION_STATE_DIR ?? path.resolve(process.cwd(), 'worker-state');
  const store = new FileStateStore(stateDirectory);

  if (command === 'submit') {
    const state = await store.load(transactionHash);
    if (!state) throw new Error('No persisted proof state. Run resume first.');
    const privateKey =
      process.env.CREDITCOIN_SETTLER_PRIVATE_KEY ?? requiredEnvironment('CREDITCOIN_DEPLOYER_PRIVATE_KEY');
    const verifierAddress = requiredEnvironment('CREDITCOIN_VERIFIER_ADDRESS');
    const settled = await submitReadyProof({
      state,
      store,
      rpcUrl: process.env.CREDITCOIN_TESTNET_RPC_URL ?? CREDITCOIN_TESTNET_RPC,
      verifierAddress,
      privateKey,
    });
    printSummary(settled, flags.includes('--show-proof'));
    return;
  }

  const ports = new LiveAttestationPorts({
    sourceRpcUrl: process.env.SEPOLIA_RPC_URL ?? DEFAULT_SEPOLIA_RPC,
    creditcoinRpcUrl: process.env.CREDITCOIN_TESTNET_RPC_URL ?? CREDITCOIN_TESTNET_RPC,
    proofBuilderUrl: process.env.ATTESTCOIN_PROVER_URL ?? ATTESTCOIN_PROVER_URL,
  });
  const worker = new AttestationWorker(ports, store, {
    ...(process.env.SEPOLIA_REGISTRY_ADDRESS
      ? { expectedSourceRegistry: process.env.SEPOLIA_REGISTRY_ADDRESS }
      : {}),
  });

  let state = await worker.step(transactionHash);
  const shouldWait = command === 'resume' && flags.includes('--wait');
  const deadline = Date.now() + parseWaitTimeout(flags);
  while (
    shouldWait &&
    ['DISCOVERING', 'MINED', 'WAITING_ATTESTATION'].includes(state.phase) &&
    Date.now() < deadline
  ) {
    await delay(15_000);
    state = await worker.step(transactionHash);
    printSummary(state, false);
  }
  printSummary(state, flags.includes('--show-proof'));
}

function parseWaitTimeout(flags: string[]): number {
  const timeoutFlag = flags.find((flag) => flag.startsWith('--timeout-minutes='));
  if (!timeoutFlag) return 20 * 60_000;
  const value = Number(timeoutFlag.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 60) {
    throw new Error('--timeout-minutes must be between 1 and 60');
  }
  return value * 60_000;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for this command`);
  return value;
}

function printSummary(state: Awaited<ReturnType<AttestationWorker['step']>>, showProof: boolean): void {
  const output = showProof ? state : { ...state, proof: state.proof ? proofSummary(state) : undefined };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function proofSummary(state: Awaited<ReturnType<AttestationWorker['step']>>) {
  if (!state.proof) return undefined;
  return {
    transactionIndex: state.proof.txIndex,
    encodedTransactionBytes: (state.proof.txBytes.length - 2) / 2,
    merkleSiblingCount: state.proof.merkleProof.siblings.length,
    continuityRootCount: state.proof.continuityProof.roots.length,
    cached: state.proof.cached,
    generatedAt: state.proof.generatedAt,
  };
}

function usage(): void {
  process.stderr.write(
    'Usage: chargeproof-attestation <inspect|resume|submit> <sepolia-tx-hash> [--wait] [--timeout-minutes=20] [--show-proof]\n',
  );
}
