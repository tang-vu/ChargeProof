import { z } from 'zod';

const hex = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const proofDataSchema = z.object({
  chainKey: z.number().int().positive(),
  headerNumber: z.number().int().nonnegative(),
  txIndex: z.number().int().nonnegative(),
  txHash: hash,
  txBytes: hex,
  merkleProof: z.object({
    root: hash,
    siblings: z.array(z.object({ hash, isLeft: z.boolean() })),
  }),
  continuityProof: z.object({
    lowerEndpointDigest: hash,
    roots: z.array(hash),
  }),
  cached: z.boolean(),
  generatedAt: z.string().datetime(),
});

export const workerStateSchema = z.object({
  schemaVersion: z.literal(1),
  transactionHash: hash,
  phase: z.enum([
    'DISCOVERING',
    'MINED',
    'WAITING_ATTESTATION',
    'PROOF_READY',
    'SUBMITTED',
    'SETTLED',
    'FAILED',
  ]),
  chainKey: z.number().int().positive(),
  sourceChainId: z.number().int().positive(),
  blockNumber: z.number().int().nonnegative().optional(),
  transactionIndex: z.number().int().nonnegative().optional(),
  sourceFrom: address.optional(),
  sourceTo: address.optional(),
  sourceReceiptStatus: z.number().int().min(0).max(1).optional(),
  targetAttestedHeight: z.number().int().nonnegative().optional(),
  latestOnchainAttestedHeight: z.number().int().nonnegative().optional(),
  latestProverAttestedHeight: z.number().int().nonnegative().optional(),
  proof: proofDataSchema.optional(),
  precompileVerified: z.boolean().optional(),
  settlementTransactionHash: hash.optional(),
  settlementBlockNumber: z.number().int().nonnegative().optional(),
  attempts: z.number().int().nonnegative(),
  lastError: z
    .object({
      code: z.string(),
      message: z.string(),
      retriable: z.boolean(),
      at: z.string().datetime(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProofData = z.infer<typeof proofDataSchema>;
export type WorkerState = z.infer<typeof workerStateSchema>;
export type WorkerPhase = WorkerState['phase'];

export type SourceObservation = {
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string | null;
  input: string;
  receiptStatus: number;
};

export type ChainObservation = {
  chainKey: number;
  chainId: number;
  encoding: number;
  latestOnchainAttestedHeight: number;
  latestProverAttestedHeight: number;
};

export interface AttestationPorts {
  inspectSource(transactionHash: string): Promise<SourceObservation | null>;
  inspectChain(chainKey: number): Promise<ChainObservation>;
  generateProof(transactionHash: string): Promise<ProofData>;
  verifyProof(proof: ProofData): Promise<boolean>;
}
