import { createPublicClient, createWalletClient, getAddress, http, isHex, size, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { attestcoinChargeVerifierAbi, creditcoinTestnet, proofContractArguments } from '@chargeproof/shared';

import type { WorkerState } from './model.js';
import type { FileStateStore } from './state-store.js';

export async function submitReadyProof(options: {
  state: WorkerState;
  store: FileStateStore;
  rpcUrl: string;
  verifierAddress: string;
  privateKey: string;
}): Promise<WorkerState> {
  if (options.state.phase === 'SETTLED') return options.state;
  if (!options.state.proof || !options.state.precompileVerified) {
    throw new Error('State does not contain a live-precompile-verified proof');
  }

  if (!isHex(options.privateKey) || size(options.privateKey) !== 32) {
    throw new Error('A 32-byte CREDITCOIN_SETTLER_PRIVATE_KEY is required');
  }
  const verifierAddress = getAddress(options.verifierAddress);
  const account = privateKeyToAccount(options.privateKey);
  const publicClient = createPublicClient({ chain: creditcoinTestnet, transport: http(options.rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: creditcoinTestnet,
    transport: http(options.rpcUrl),
  });
  if (options.state.phase === 'SUBMITTED' && options.state.settlementTransactionHash) {
    const priorReceipt = await publicClient.getTransactionReceipt({
      hash: options.state.settlementTransactionHash as Hex,
    });
    if (priorReceipt.status !== 'success') {
      throw new Error('Previously submitted settlement transaction reverted');
    }
    const settled = {
      ...options.state,
      phase: 'SETTLED' as const,
      settlementBlockNumber: Number(priorReceipt.blockNumber),
      updatedAt: new Date().toISOString(),
    };
    await options.store.save(settled);
    return settled;
  }

  const proof = options.state.proof;
  const argument = proofContractArguments({
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
  });

  let gasLimit: bigint;
  try {
    const estimate = await publicClient.estimateContractGas({
      account,
      address: verifierAddress,
      abi: attestcoinChargeVerifierAbi,
      functionName: 'verifyAndSettle',
      args: [argument],
    });
    gasLimit = (estimate * 135n) / 100n;
  } catch {
    // Creditcoin pallet-EVM estimates can fail at precompile boundaries. This conservative fallback
    // follows the official example's proof-size strategy with extra headroom for ChargeProof checks.
    gasLimit = 650_000n + BigInt(proof.continuityProof.roots.length) * 7_500n;
  }

  const transactionHash = await walletClient.writeContract({
    address: verifierAddress,
    abi: attestcoinChargeVerifierAbi,
    functionName: 'verifyAndSettle',
    args: [argument],
    gas: gasLimit,
  });
  const submitted: WorkerState = {
    ...options.state,
    phase: 'SUBMITTED',
    settlementTransactionHash: transactionHash,
    updatedAt: new Date().toISOString(),
  };
  await options.store.save(submitted);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== 'success') throw new Error('Settlement transaction did not succeed');

  const settled: WorkerState = {
    ...submitted,
    phase: 'SETTLED',
    settlementBlockNumber: Number(receipt.blockNumber),
    updatedAt: new Date().toISOString(),
  };
  await options.store.save(settled);
  return settled;
}
