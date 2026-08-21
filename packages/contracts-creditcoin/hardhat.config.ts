import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { configVariable, defineConfig } from 'hardhat/config';

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 500 },
      viaIR: true,
      evmVersion: 'cancun',
    },
  },
  networks: {
    creditcoinTestnet: {
      type: 'http',
      chainType: 'l1',
      chainId: 102_031,
      url: configVariable('CREDITCOIN_TESTNET_RPC_URL'),
      accounts: [configVariable('CREDITCOIN_DEPLOYER_PRIVATE_KEY')],
    },
  },
});
