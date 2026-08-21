import path from 'node:path';

import dotenv from 'dotenv';
import { formatEther, JsonRpcProvider, Wallet } from 'ethers';

dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true });

const required = [
  'SEPOLIA_RPC_URL',
  'CREDITCOIN_TESTNET_RPC_URL',
  'SEPOLIA_DEPLOYER_PRIVATE_KEY',
  'CREDITCOIN_DEPLOYER_PRIVATE_KEY',
  'DEVICE_SIMULATOR_PRIVATE_KEY',
  'DEVICE_SIGNER_ADDRESS',
  'STATION_PAYOUT_ADDRESS',
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const sepoliaWallet = new Wallet(process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY);
const creditcoinWallet = new Wallet(process.env.CREDITCOIN_DEPLOYER_PRIVATE_KEY);
const deviceWallet = new Wallet(process.env.DEVICE_SIMULATOR_PRIVATE_KEY);

if (sepoliaWallet.address !== creditcoinWallet.address) {
  throw new Error('The Sepolia and Creditcoin deployer keys must represent the same demo driver.');
}
if (deviceWallet.address !== process.env.DEVICE_SIGNER_ADDRESS) {
  throw new Error('DEVICE_SIGNER_ADDRESS does not match DEVICE_SIMULATOR_PRIVATE_KEY.');
}
if (sepoliaWallet.address !== process.env.STATION_PAYOUT_ADDRESS) {
  throw new Error('STATION_PAYOUT_ADDRESS does not match the dedicated demo payout wallet.');
}

const sepoliaProvider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL, 11155111);
const creditcoinProvider = new JsonRpcProvider(process.env.CREDITCOIN_TESTNET_RPC_URL, 102031);
const [sepoliaBalance, creditcoinBalance] = await Promise.all([
  sepoliaProvider.getBalance(sepoliaWallet.address),
  creditcoinProvider.getBalance(creditcoinWallet.address),
]);

process.stdout.write(
  `${JSON.stringify(
    {
      deployerAddress: sepoliaWallet.address,
      deviceSignerAddress: deviceWallet.address,
      networks: {
        sepolia: {
          chainId: 11155111,
          nativeBalance: formatEther(sepoliaBalance),
          hasGas: sepoliaBalance > 0n,
        },
        creditcoinTestnet: {
          chainId: 102031,
          nativeBalance: formatEther(creditcoinBalance),
          hasGas: creditcoinBalance > 0n,
        },
      },
      readyForDeployment: sepoliaBalance > 0n && creditcoinBalance > 0n,
    },
    null,
    2,
  )}\n`,
);
