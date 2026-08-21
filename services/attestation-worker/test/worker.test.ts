import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AttestationPorts, ProofData } from '../src/model.js';
import { FileStateStore } from '../src/state-store.js';
import { AttestationWorker } from '../src/worker.js';

const transactionHash = `0x${'ab'.repeat(32)}`;
const sourceRegistry = '0x1111111111111111111111111111111111111111';
const driver = '0x2222222222222222222222222222222222222222';

const proof: ProofData = {
  chainKey: 1,
  headerNumber: 100,
  txIndex: 2,
  txHash: transactionHash,
  txBytes: '0x1234',
  merkleProof: { root: `0x${'33'.repeat(32)}`, siblings: [] },
  continuityProof: {
    lowerEndpointDigest: `0x${'44'.repeat(32)}`,
    roots: [`0x${'55'.repeat(32)}`],
  },
  cached: false,
  generatedAt: '2026-08-21T00:00:00.000Z',
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup(latestHeight: number) {
  const directory = await mkdtemp(path.join(tmpdir(), 'chargeproof-worker-test-'));
  temporaryDirectories.push(directory);
  const inspectSource = vi.fn().mockResolvedValue({
    blockNumber: 100,
    transactionIndex: 2,
    from: driver,
    to: sourceRegistry,
    input: '0x12345678',
    receiptStatus: 1,
  });
  const inspectChain = vi.fn().mockResolvedValue({
    chainKey: 1,
    chainId: 11_155_111,
    encoding: 1,
    latestOnchainAttestedHeight: latestHeight,
    latestProverAttestedHeight: latestHeight,
  });
  const generateProof = vi.fn().mockResolvedValue(proof);
  const verifyProof = vi.fn().mockResolvedValue(true);
  const ports: AttestationPorts = {
    inspectSource,
    inspectChain,
    generateProof,
    verifyProof,
  };
  const store = new FileStateStore(directory);
  const worker = new AttestationWorker(ports, store, {
    now: () => new Date('2026-08-21T00:00:00.000Z'),
  });
  return {
    directory,
    ports,
    store,
    worker,
    mocks: { inspectSource, inspectChain, generateProof, verifyProof },
  };
}

describe('AttestationWorker', () => {
  it('persists a resumable waiting state without requesting a premature proof', async () => {
    const { directory, mocks, worker } = await setup(100);
    const state = await worker.step(transactionHash);
    expect(state.phase).toBe('WAITING_ATTESTATION');
    expect(state.targetAttestedHeight).toBe(101);
    expect(mocks.generateProof).not.toHaveBeenCalled();

    const persisted = JSON.parse(await readFile(path.join(directory, `${transactionHash}.json`), 'utf8')) as {
      phase: string;
    };
    expect(persisted.phase).toBe('WAITING_ATTESTATION');
  });

  it('generates and locally verifies a proof only after block N+1 is available', async () => {
    const { mocks, worker } = await setup(101);
    const state = await worker.step(transactionHash);
    expect(state.phase).toBe('PROOF_READY');
    expect(state.precompileVerified).toBe(true);
    expect(state.proof?.txHash).toBe(transactionHash);
    expect(mocks.generateProof).toHaveBeenCalledOnce();
    expect(mocks.verifyProof).toHaveBeenCalledWith(proof);
  });

  it('does not regenerate an idempotently persisted ready proof', async () => {
    const { mocks, worker } = await setup(101);
    await worker.step(transactionHash);
    const second = await worker.step(transactionHash);
    expect(second.phase).toBe('PROOF_READY');
    expect(mocks.generateProof).toHaveBeenCalledOnce();
  });

  it('records source reverts and chain mapping changes as terminal failures', async () => {
    const { mocks, worker } = await setup(101);
    mocks.inspectSource.mockResolvedValueOnce({
      blockNumber: 100,
      transactionIndex: 2,
      from: driver,
      to: sourceRegistry,
      input: '0x1234',
      receiptStatus: 0,
    });
    const reverted = await worker.step(transactionHash);
    expect(reverted.phase).toBe('FAILED');
    expect(reverted.lastError?.code).toBe('SOURCE_TX_REVERTED');
  });

  it('rejects non-ChargeProof calldata when a canonical registry is configured', async () => {
    const { ports, store } = await setup(101);
    const strictWorker = new AttestationWorker(ports, store, {
      expectedSourceRegistry: sourceRegistry,
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    });
    const state = await strictWorker.step(`0x${'cd'.repeat(32)}`);
    expect(state.phase).toBe('FAILED');
    expect(state.lastError?.code).toBe('WRONG_SOURCE_CALL');
  });

  it('keeps RPC failures retriable with diagnostics', async () => {
    const { mocks, worker } = await setup(101);
    mocks.inspectSource.mockRejectedValueOnce(new Error('RPC timeout'));
    const state = await worker.step(transactionHash);
    expect(state.phase).toBe('DISCOVERING');
    expect(state.lastError).toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR', retriable: true });
  });
});
