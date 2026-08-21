import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { network } from 'hardhat';
import { getAddress, isAddress } from 'viem';

import type { ChargingSessionRegistry } from '../types/ethers-contracts/ChargingSessionRegistry.js';

const deploymentPath = path.resolve(import.meta.dirname, '../../../deployments/sepolia.json');

async function main() {
  const deviceSigner = requiredAddress('DEVICE_SIGNER_ADDRESS');
  const { ethers } = await network.create('sepolia');
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No Sepolia deployer is configured');

  const existing = await readDeployment();
  if (existing?.status === 'deployed' && typeof existing.contracts?.chargingSessionRegistry === 'string') {
    const code = await ethers.provider.getCode(existing.contracts.chargingSessionRegistry);
    if (code !== '0x') {
      process.stdout.write(`Reusing verified deployment metadata at ${deploymentPath}\n`);
      return;
    }
    throw new Error('Deployment metadata exists but the recorded registry has no bytecode');
  }

  const registry = (await ethers.deployContract('ChargingSessionRegistry', [
    deployer.address,
  ])) as unknown as ChargingSessionRegistry;
  await registry.waitForDeployment();
  const stationId = ethers.encodeBytes32String('CP-SGN-001');
  const configuration = await registry.configureStation(
    stationId,
    deviceSigner,
    true,
    'https://chargeproof.example/stations/cp-sgn-001.json',
  );
  await configuration.wait();
  const deploymentTransaction = registry.deploymentTransaction();
  if (!deploymentTransaction) throw new Error('Registry deployment transaction is unavailable');

  const deployment = {
    schemaVersion: 1,
    project: 'ChargeProof',
    status: 'deployed',
    network: 'ethereum-sepolia',
    chainId: 11_155_111,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: { chargingSessionRegistry: await registry.getAddress() },
    transactions: {
      deployChargingSessionRegistry: deploymentTransaction.hash,
      configureStation: configuration.hash,
    },
    station: { stationId, deviceSigner },
    explorer: 'https://sepolia.etherscan.io',
  };
  await writeDeployment(deployment);
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

async function readDeployment(): Promise<
  (Record<string, unknown> & { contracts?: Record<string, unknown> }) | undefined
> {
  try {
    return JSON.parse(await readFile(deploymentPath, 'utf8')) as Record<string, unknown> & {
      contracts?: Record<string, unknown>;
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeDeployment(value: unknown): Promise<void> {
  await mkdir(path.dirname(deploymentPath), { recursive: true });
  const temporary = `${deploymentPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, deploymentPath);
}

function requiredAddress(name: string) {
  const value = process.env[name];
  if (!value || !isAddress(value)) throw new Error(`${name} must contain a valid public address`);
  return getAddress(value);
}

await main();
