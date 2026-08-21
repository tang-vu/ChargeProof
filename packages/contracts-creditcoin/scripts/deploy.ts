import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { network } from 'hardhat';
import { getAddress, isAddress } from 'viem';

import type {
  AttestcoinChargeVerifier,
  ChargeIntentEscrow,
  MockUSDC,
  StationRegistry,
} from '../types/ethers-contracts/index.js';

const deploymentPath = path.resolve(import.meta.dirname, '../../../deployments/creditcoin-testnet.json');
const blockProver = '0x0000000000000000000000000000000000000FD2';

async function main() {
  const sourceRegistry = requiredAddress('SEPOLIA_REGISTRY_ADDRESS');
  const deviceSigner = requiredAddress('DEVICE_SIGNER_ADDRESS');
  const { ethers } = await network.create('creditcoinTestnet');
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No Creditcoin Testnet deployer is configured');
  const payout = optionalAddress('STATION_PAYOUT_ADDRESS') ?? deployer.address;

  const existing = await readDeployment();
  if (existing?.status === 'deployed' && existing.contracts) {
    const addresses = Object.values(existing.contracts).filter(
      (value): value is string => typeof value === 'string' && isAddress(value),
    );
    const codes = await Promise.all(addresses.map(async (address) => await ethers.provider.getCode(address)));
    if (addresses.length === 4 && codes.every((code) => code !== '0x')) {
      process.stdout.write(`Reusing verified deployment metadata at ${deploymentPath}\n`);
      return;
    }
    throw new Error('Deployment metadata exists but one or more recorded contracts have no bytecode');
  }

  const token = (await ethers.deployContract('MockUSDC')) as unknown as MockUSDC;
  const stations = (await ethers.deployContract('StationRegistry', [
    deployer.address,
  ])) as unknown as StationRegistry;
  await Promise.all([token.waitForDeployment(), stations.waitForDeployment()]);
  const escrow = (await ethers.deployContract('ChargeIntentEscrow', [
    deployer.address,
    await token.getAddress(),
    await stations.getAddress(),
  ])) as unknown as ChargeIntentEscrow;
  await escrow.waitForDeployment();
  const verifier = (await ethers.deployContract('AttestcoinChargeVerifier', [
    await escrow.getAddress(),
    blockProver,
    1,
    sourceRegistry,
  ])) as unknown as AttestcoinChargeVerifier;
  await verifier.waitForDeployment();

  const stationId = ethers.encodeBytes32String('CP-SGN-001');
  const registerStation = await stations.registerStation(
    stationId,
    payout,
    deviceSigner,
    'https://chargeproof.example/stations/cp-sgn-001.json',
  );
  await registerStation.wait();
  const setMetricsRecorder = await stations.setMetricsRecorder(await escrow.getAddress());
  await setMetricsRecorder.wait();
  const setVerifier = await escrow.setVerifier(await verifier.getAddress());
  await setVerifier.wait();

  const tokenDeployment = token.deploymentTransaction();
  const stationsDeployment = stations.deploymentTransaction();
  const escrowDeployment = escrow.deploymentTransaction();
  const verifierDeployment = verifier.deploymentTransaction();
  if (!tokenDeployment || !stationsDeployment || !escrowDeployment || !verifierDeployment) {
    throw new Error('One or more deployment transaction hashes are unavailable');
  }

  const deployment = {
    schemaVersion: 1,
    project: 'ChargeProof',
    status: 'deployed',
    network: 'creditcoin-testnet',
    chainId: 102_031,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      mockUsdc: await token.getAddress(),
      stationRegistry: await stations.getAddress(),
      chargeIntentEscrow: await escrow.getAddress(),
      attestcoinChargeVerifier: await verifier.getAddress(),
    },
    transactions: {
      deployMockUsdc: tokenDeployment.hash,
      deployStationRegistry: stationsDeployment.hash,
      deployChargeIntentEscrow: escrowDeployment.hash,
      deployAttestcoinChargeVerifier: verifierDeployment.hash,
      registerStation: registerStation.hash,
      setMetricsRecorder: setMetricsRecorder.hash,
      setVerifier: setVerifier.hash,
    },
    attestcoin: {
      sourceChainKey: 1,
      sourceChainId: 11_155_111,
      sourceRegistry,
      blockProver,
    },
    station: { stationId, payout, deviceSigner },
    explorer: 'https://creditcoin-testnet.blockscout.com',
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

function optionalAddress(name: string) {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} must contain a valid public address`);
  return getAddress(value);
}

await main();
