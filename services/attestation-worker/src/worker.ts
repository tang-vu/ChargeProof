import { decodeFunctionData, getAddress, isHash } from 'viem';

import {
  SEPOLIA_ATTESTCOIN_CHAIN_KEY,
  SEPOLIA_CHAIN_ID,
  chargingSessionRegistryAbi,
  type ChargingReceipt,
} from '@chargeproof/shared';

import type { AttestationPorts, WorkerState } from './model.js';
import type { FileStateStore } from './state-store.js';

export type WorkerOptions = {
  chainKey?: number;
  sourceChainId?: number;
  expectedSourceRegistry?: string;
  now?: () => Date;
};

export class AttestationWorker {
  private readonly chainKey: number;
  private readonly sourceChainId: number;
  private readonly expectedSourceRegistry: string | undefined;
  private readonly now: () => Date;

  public constructor(
    private readonly ports: AttestationPorts,
    private readonly store: FileStateStore,
    options: WorkerOptions = {},
  ) {
    this.chainKey = options.chainKey ?? SEPOLIA_ATTESTCOIN_CHAIN_KEY;
    this.sourceChainId = options.sourceChainId ?? SEPOLIA_CHAIN_ID;
    this.expectedSourceRegistry = options.expectedSourceRegistry
      ? getAddress(options.expectedSourceRegistry)
      : undefined;
    this.now = options.now ?? (() => new Date());
  }

  /** Advance the state machine as far as current external state allows, then persist and return. */
  public async step(transactionHash: string): Promise<WorkerState> {
    if (!isHash(transactionHash)) throw new Error('A 32-byte source transaction hash is required');
    const normalizedHash = transactionHash.toLowerCase();
    let state =
      (await this.store.load(normalizedHash)) ?? this.newState(normalizedHash, this.now().toISOString());

    if (state.phase === 'SETTLED' || state.phase === 'SUBMITTED' || state.phase === 'PROOF_READY') {
      return state;
    }

    state = { ...state, attempts: state.attempts + 1, updatedAt: this.now().toISOString() };
    try {
      const source = await this.ports.inspectSource(normalizedHash);
      if (!source) {
        return await this.persistError(
          state,
          'SOURCE_NOT_FOUND',
          'Source transaction is not mined yet',
          true,
        );
      }
      if (source.receiptStatus !== 1) {
        return await this.persistError(
          state,
          'SOURCE_TX_REVERTED',
          'Source transaction receipt status is not 1',
          false,
        );
      }
      if (!source.to) {
        return await this.persistError(
          state,
          'SOURCE_CONTRACT_CREATION',
          'Expected a contract call, not creation',
          false,
        );
      }
      if (this.expectedSourceRegistry && getAddress(source.to) !== getAddress(this.expectedSourceRegistry)) {
        return await this.persistError(
          state,
          'WRONG_SOURCE_CONTRACT',
          `Transaction target ${source.to} is not the canonical ChargeProof registry`,
          false,
        );
      }
      const receipt = decodeChargeProofCalldata(source.input);
      if (this.expectedSourceRegistry && !receipt) {
        return await this.persistError(
          state,
          'WRONG_SOURCE_CALL',
          'Transaction calldata is not the canonical finalizeSession call',
          false,
        );
      }
      if (receipt && getAddress(receipt.driver) !== getAddress(source.from)) {
        return await this.persistError(
          state,
          'WRONG_SOURCE_SENDER',
          'Transaction sender does not match the receipt driver',
          false,
        );
      }

      state = {
        ...state,
        phase: 'MINED',
        blockNumber: source.blockNumber,
        transactionIndex: source.transactionIndex,
        sourceFrom: getAddress(source.from),
        sourceTo: getAddress(source.to),
        sourceReceiptStatus: source.receiptStatus,
        targetAttestedHeight: source.blockNumber + 1,
        lastError: undefined,
      };

      const chain = await this.ports.inspectChain(this.chainKey);
      if (chain.chainKey !== this.chainKey || chain.chainId !== this.sourceChainId || chain.encoding !== 1) {
        return await this.persistError(
          state,
          'CHAIN_MAPPING_CHANGED',
          `Chain key ${this.chainKey} does not map to expected EVM chain ${this.sourceChainId}`,
          false,
        );
      }

      const targetHeight = source.blockNumber + 1;
      state = {
        ...state,
        latestOnchainAttestedHeight: chain.latestOnchainAttestedHeight,
        latestProverAttestedHeight: chain.latestProverAttestedHeight,
      };
      if (
        chain.latestOnchainAttestedHeight < targetHeight ||
        chain.latestProverAttestedHeight < targetHeight
      ) {
        state = { ...state, phase: 'WAITING_ATTESTATION', updatedAt: this.now().toISOString() };
        await this.store.save(state);
        return state;
      }

      const proof = await this.ports.generateProof(normalizedHash);
      if (
        proof.chainKey !== this.chainKey ||
        proof.headerNumber !== source.blockNumber ||
        proof.txIndex !== source.transactionIndex ||
        proof.txHash.toLowerCase() !== normalizedHash
      ) {
        return await this.persistError(
          state,
          'PROOF_METADATA_MISMATCH',
          'Proof metadata does not match the observed source transaction',
          false,
        );
      }
      const precompileVerified = await this.ports.verifyProof(proof);
      if (!precompileVerified) {
        return await this.persistError(
          state,
          'PRECOMPILE_REJECTED',
          'Live Block Prover rejected the proof',
          false,
        );
      }

      state = {
        ...state,
        phase: 'PROOF_READY',
        proof,
        precompileVerified: true,
        lastError: undefined,
        updatedAt: this.now().toISOString(),
      };
      await this.store.save(state);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return await this.persistError(state, 'EXTERNAL_SERVICE_ERROR', message, true);
    }
  }

  private newState(transactionHash: string, timestamp: string): WorkerState {
    return {
      schemaVersion: 1,
      transactionHash,
      phase: 'DISCOVERING',
      chainKey: this.chainKey,
      sourceChainId: this.sourceChainId,
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private async persistError(
    state: WorkerState,
    code: string,
    message: string,
    retriable: boolean,
  ): Promise<WorkerState> {
    const timestamp = this.now().toISOString();
    const next: WorkerState = {
      ...state,
      phase: retriable ? state.phase : 'FAILED',
      lastError: { code, message, retriable, at: timestamp },
      updatedAt: timestamp,
    };
    await this.store.save(next);
    return next;
  }
}

function decodeChargeProofCalldata(input: string): ChargingReceipt | undefined {
  try {
    const decoded = decodeFunctionData({
      abi: chargingSessionRegistryAbi,
      data: input as `0x${string}`,
    });
    if (decoded.functionName !== 'finalizeSession') return undefined;
    return decoded.args[0];
  } catch {
    return undefined;
  }
}
