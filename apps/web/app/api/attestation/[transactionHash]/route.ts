import { tmpdir } from 'node:os';
import path from 'node:path';

import { NextResponse } from 'next/server';
import { isHash } from 'viem';

import { ATTESTCOIN_PROVER_URL, CREDITCOIN_TESTNET_RPC, DEFAULT_SEPOLIA_RPC } from '@chargeproof/shared';
import { AttestationWorker, FileStateStore, LiveAttestationPorts } from '@chargeproof/attestation-worker';

export async function GET(_request: Request, context: { params: Promise<{ transactionHash: string }> }) {
  const { transactionHash } = await context.params;
  if (!isHash(transactionHash)) {
    return NextResponse.json({ error: 'INVALID_TRANSACTION_HASH' }, { status: 400 });
  }

  const ports = new LiveAttestationPorts({
    sourceRpcUrl: process.env.SEPOLIA_RPC_URL ?? DEFAULT_SEPOLIA_RPC,
    creditcoinRpcUrl: process.env.CREDITCOIN_TESTNET_RPC_URL ?? CREDITCOIN_TESTNET_RPC,
    proofBuilderUrl: process.env.ATTESTCOIN_PROVER_URL ?? ATTESTCOIN_PROVER_URL,
  });
  const stateDirectory =
    process.env.ATTESTATION_STATE_DIR ?? path.join(tmpdir(), 'chargeproof-attestation-state');
  const store = new FileStateStore(stateDirectory);
  const worker = new AttestationWorker(ports, store, {
    ...(process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS
      ? { expectedSourceRegistry: process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS }
      : {}),
  });

  const state = await worker.step(transactionHash);
  return NextResponse.json(state, {
    status: state.phase === 'FAILED' ? 422 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
