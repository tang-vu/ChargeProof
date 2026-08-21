import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { config as loadEnvironment } from 'dotenv';
import { configVariable, defineConfig } from 'hardhat/config';
import path from 'node:path';

loadEnvironment({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

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
