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
    creditcoinTestnet: {
      type: 'http',
      chainType: 'l1',
      chainId: 102_031,
      url: configVariable('CREDITCOIN_TESTNET_RPC_URL'),
      accounts: [configVariable('CREDITCOIN_DEPLOYER_PRIVATE_KEY')],
    },
  },
});
