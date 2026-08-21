import { constants as fsConstants } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Wallet } from 'ethers';

const root = process.cwd();
const rootEnvPath = path.join(root, '.env');
const webEnvPath = path.join(root, 'apps', 'web', '.env.local');

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

if ((await exists(rootEnvPath)) || (await exists(webEnvPath))) {
  throw new Error(
    'Refusing to overwrite an existing .env or apps/web/.env.local file. Back up or remove the intended file explicitly first.',
  );
}

const deployer = Wallet.createRandom();
const device = Wallet.createRandom();

const rootEnv = `# Generated dedicated testnet burners. Never commit or share this file.
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CREDITCOIN_TESTNET_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
ATTESTCOIN_PROVER_URL=https://prover.cc3-testnet.creditcoin.network
ATTESTCOIN_SOURCE_CHAIN_KEY=1

NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_ESCROW_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_VERIFIER_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_STATION_REGISTRY_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_MOCK_USDC_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

SEPOLIA_DEPLOYER_PRIVATE_KEY=${deployer.privateKey}
CREDITCOIN_DEPLOYER_PRIVATE_KEY=${deployer.privateKey}
CREDITCOIN_SETTLER_PRIVATE_KEY=${deployer.privateKey}
DEVICE_SIMULATOR_PRIVATE_KEY=${device.privateKey}
DEVICE_SIGNER_ADDRESS=${device.address}
STATION_PAYOUT_ADDRESS=${deployer.address}
SEPOLIA_REGISTRY_ADDRESS=
CREDITCOIN_VERIFIER_ADDRESS=
`;

const webEnv = `# Generated local testnet configuration. Never commit or share this file.
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_ESCROW_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_VERIFIER_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_STATION_REGISTRY_ADDRESS=
NEXT_PUBLIC_CREDITCOIN_MOCK_USDC_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
DEVICE_SIMULATOR_PRIVATE_KEY=${device.privateKey}
DEVICE_SIGNER_ADDRESS=${device.address}
`;

await mkdir(path.dirname(webEnvPath), { recursive: true });
await writeFile(rootEnvPath, rootEnv, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
await writeFile(webEnvPath, webEnv, { encoding: 'utf8', mode: 0o600, flag: 'wx' });

process.stdout.write(
  `${JSON.stringify(
    {
      created: true,
      deployerAddress: deployer.address,
      deviceSignerAddress: device.address,
      stationPayoutAddress: deployer.address,
      files: ['.env', 'apps/web/.env.local'],
      fundingRequired: ['Ethereum Sepolia ETH', 'Creditcoin Testnet CTC'],
    },
    null,
    2,
  )}\n`,
);
