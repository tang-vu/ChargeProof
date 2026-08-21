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
    sepolia: {
      type: 'http',
      chainType: 'l1',
      chainId: 11_155_111,
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('SEPOLIA_DEPLOYER_PRIVATE_KEY')],
    },
  },
});
