import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

import { CREDITCOIN_TESTNET_RPC, DEFAULT_SEPOLIA_RPC, creditcoinTestnet } from '@chargeproof/shared';

export const wagmiConfig = createConfig({
  chains: [creditcoinTestnet, sepolia],
  connectors: [injected()],
  transports: {
    [creditcoinTestnet.id]: http(CREDITCOIN_TESTNET_RPC),
    [sepolia.id]: http(DEFAULT_SEPOLIA_RPC),
  },
  ssr: true,
});
