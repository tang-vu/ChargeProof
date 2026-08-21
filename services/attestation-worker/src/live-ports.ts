import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { JsonRpcProvider } from 'ethers';

import type { AttestationPorts, ChainObservation, ProofData, SourceObservation } from './model.js';
import { proofDataSchema } from './model.js';

export type LivePortOptions = {
  sourceRpcUrl: string;
  creditcoinRpcUrl: string;
  proofBuilderUrl: string;
};

export class LiveAttestationPorts implements AttestationPorts {
  private readonly sourceProvider: JsonRpcProvider;
  private readonly creditcoinProvider: JsonRpcProvider;
  private readonly chainInfoProvider: chainInfo.PrecompileChainInfoProvider;
  private readonly prover: blockProver.PrecompileBlockProver;

  public constructor(private readonly options: LivePortOptions) {
    this.sourceProvider = new JsonRpcProvider(options.sourceRpcUrl);
    this.creditcoinProvider = new JsonRpcProvider(options.creditcoinRpcUrl);
    this.chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(this.creditcoinProvider);
    this.prover = new blockProver.PrecompileBlockProver(this.creditcoinProvider);
  }

  public async inspectSource(transactionHash: string): Promise<SourceObservation | null> {
    const [transaction, receipt] = await Promise.all([
      this.sourceProvider.getTransaction(transactionHash),
      this.sourceProvider.getTransactionReceipt(transactionHash),
    ]);
    if (!transaction || !receipt || transaction.blockNumber === null) return null;
    return {
      blockNumber: transaction.blockNumber,
      transactionIndex: transaction.index,
      from: transaction.from,
      to: transaction.to,
      input: transaction.data,
      receiptStatus: receipt.status ?? 0,
    };
  }

  public async inspectChain(chainKey: number): Promise<ChainObservation> {
    const [supported, latest, proverHeight] = await Promise.all([
      this.chainInfoProvider.getSupportedChainByKey(chainKey),
      this.chainInfoProvider.getLatestAttestedHeightAndHash(chainKey),
      this.getProverAttestedHeight(chainKey),
    ]);
    if (!supported || !latest.exists) throw new Error(`Chain key ${chainKey} is unavailable on Creditcoin`);
    return {
      chainKey: supported.chainKey,
      chainId: supported.chainId,
      encoding: supported.chainEncoding,
      latestOnchainAttestedHeight: latest.height,
      latestProverAttestedHeight: proverHeight,
    };
  }

  public async generateProof(transactionHash: string): Promise<ProofData> {
    const builder = new proofProvider.service.ProofBuilder(1, this.options.proofBuilderUrl, 30_000);
    const result = await builder.getProof(transactionHash);
    if (!result.success || !result.data) throw new Error(result.error ?? 'Proof API returned no proof data');
    const data = result.data;
    return proofDataSchema.parse({
      chainKey: data.chainKey,
      headerNumber: data.headerNumber,
      txIndex: data.txIndex,
      txHash: data.txHash,
      txBytes: data.txBytes,
      merkleProof: data.merkleProof,
      continuityProof: data.continuityProof,
      cached: data.cached,
      generatedAt: new Date(String(data.generatedAt)).toISOString(),
    });
  }

  public async verifyProof(proof: ProofData): Promise<boolean> {
    return await this.prover.verifySingle(
      proof.chainKey,
      proof.headerNumber,
      proof.txBytes,
      proof.merkleProof,
      proof.continuityProof,
    );
  }

  private async getProverAttestedHeight(chainKey: number): Promise<number> {
    const response = await fetch(
      `${this.options.proofBuilderUrl.replace(/\/$/, '')}/api/v1/attested-height/${chainKey}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) throw new Error(`Proof API attested-height returned HTTP ${response.status}`);
    const payload = (await response.json()) as { attestedHeight?: unknown };
    if (typeof payload.attestedHeight !== 'number') {
      throw new Error('Proof API attested-height response is malformed');
    }
    return payload.attestedHeight;
  }
}
