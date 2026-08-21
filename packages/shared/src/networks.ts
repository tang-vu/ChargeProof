import { defineChain, type Address } from 'viem';

export const CREDITCOIN_TESTNET_CHAIN_ID = 102_031;
export const SEPOLIA_CHAIN_ID = 11_155_111;
export const SEPOLIA_ATTESTCOIN_CHAIN_KEY = 1;

export const CREDITCOIN_TESTNET_RPC = 'https://rpc.cc3-testnet.creditcoin.network';
export const CREDITCOIN_TESTNET_EXPLORER = 'https://creditcoin-testnet.blockscout.com';
export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';
export const DEFAULT_SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
export const ATTESTCOIN_PROVER_URL = 'https://prover.cc3-testnet.creditcoin.network';

export const BLOCK_PROVER_ADDRESS = '0x0000000000000000000000000000000000000FD2' as Address;
export const CHAIN_INFO_ADDRESS = '0x0000000000000000000000000000000000000FD3' as Address;

export const creditcoinTestnet = defineChain({
  id: CREDITCOIN_TESTNET_CHAIN_ID,
  name: 'Creditcoin Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'tCTC', decimals: 18 },
  rpcUrls: {
    default: { http: [CREDITCOIN_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: 'Creditcoin Blockscout', url: CREDITCOIN_TESTNET_EXPLORER },
  },
  testnet: true,
});

export function explorerTransactionUrl(network: 'sepolia' | 'creditcoin-testnet', hash: string): string {
  const base = network === 'sepolia' ? SEPOLIA_EXPLORER : CREDITCOIN_TESTNET_EXPLORER;
  return `${base}/tx/${hash}`;
}
