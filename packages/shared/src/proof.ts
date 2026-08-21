import type { Hex } from 'viem';

export type MerkleSibling = { hash: Hex; isLeft: boolean };

export type AttestcoinProofData = {
  chainKey: number;
  headerNumber: number;
  txIndex: number;
  txHash: Hex;
  txBytes: Hex;
  merkleProof: {
    root: Hex;
    siblings: MerkleSibling[];
  };
  continuityProof: {
    lowerEndpointDigest: Hex;
    roots: Hex[];
  };
  cached: boolean;
  generatedAt: string;
};

export function proofContractArguments(proof: AttestcoinProofData) {
  return {
    chainKey: BigInt(proof.chainKey),
    blockHeight: BigInt(proof.headerNumber),
    encodedTransaction: proof.txBytes,
    merkleRoot: proof.merkleProof.root,
    siblings: proof.merkleProof.siblings,
    lowerEndpointDigest: proof.continuityProof.lowerEndpointDigest,
    continuityRoots: proof.continuityProof.roots,
  } as const;
}
