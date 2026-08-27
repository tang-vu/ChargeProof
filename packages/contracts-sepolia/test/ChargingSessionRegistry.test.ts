import { expect } from 'chai';
import { network } from 'hardhat';

import type { ChargingSessionRegistry } from '../types/ethers-contracts/ChargingSessionRegistry.js';

const stationId = `0x${'43'.repeat(32)}`;
const intentId = '0x1111111111111111111111111111111111111111111111111111111111111111';

const receiptTypes = {
  ChargingReceipt: [
    { name: 'intentId', type: 'bytes32' },
    { name: 'sessionId', type: 'bytes32' },
    { name: 'stationId', type: 'bytes32' },
    { name: 'driver', type: 'address' },
    { name: 'startedAt', type: 'uint64' },
    { name: 'endedAt', type: 'uint64' },
    { name: 'energyWh', type: 'uint64' },
    { name: 'tariff', type: 'uint256' },
    { name: 'finalAmount', type: 'uint256' },
    { name: 'nonce', type: 'uint64' },
  ],
};

describe('ChargingSessionRegistry', function () {
  async function setup() {
    const { ethers } = await network.create();
    const [owner, driver, outsider] = await ethers.getSigners();
    if (!owner || !driver || !outsider) throw new Error('Hardhat test signers are unavailable');
    const device = ethers.Wallet.createRandom();
    const registry = (await ethers.deployContract('ChargingSessionRegistry', [
      owner.address,
    ])) as unknown as ChargingSessionRegistry;
    await registry.waitForDeployment();
    await registry.configureStation(stationId, device.address, true, 'ipfs://chargeproof/station/cp-sgn-001');

    const latest = await ethers.provider.getBlock('latest');
    const startedAt = BigInt((latest?.timestamp ?? 1) - 600);
    const endedAt = startedAt + 300n;
    const energyWh = 4_200n;
    const tariff = 350_000n;
    const finalAmount = (energyWh * tariff + 999n) / 1_000n;
    const nonce = 1n;
    const sessionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'uint64', 'uint64'],
        [intentId, stationId, driver.address, startedAt, nonce],
      ),
    );
    const receipt = {
      intentId,
      sessionId,
      stationId,
      driver: driver.address,
      startedAt,
      endedAt,
      energyWh,
      tariff,
      finalAmount,
      nonce,
    };
    const { chainId } = await ethers.provider.getNetwork();
    const signature = await device.signTypedData(
      {
        name: 'ChargeProof Device Receipt',
        version: '1',
        chainId,
        verifyingContract: await registry.getAddress(),
      },
      receiptTypes,
      receipt,
    );

    return { ethers, owner, driver, outsider, device, registry, receipt, signature };
  }

  it('finalizes a deterministic, authorized device receipt', async function () {
    const { driver, registry, receipt, signature } = await setup();

    await expect(registry.connect(driver).finalizeSession(receipt, signature))
      .to.emit(registry, 'SessionFinalized')
      .withArgs(
        receipt.intentId,
        receipt.sessionId,
        receipt.stationId,
        receipt.driver,
        receipt.startedAt,
        receipt.endedAt,
        receipt.energyWh,
        receipt.tariff,
        receipt.finalAmount,
        receipt.nonce,
        await registry.receiptDigest(receipt),
      );
    expect(await registry.finalizedSessions(receipt.sessionId)).to.equal(true);
    expect(await registry.usedDeviceNonces(receipt.stationId, receipt.nonce)).to.equal(true);
  });

  it('rejects a non-driver caller', async function () {
    const { outsider, registry, receipt, signature } = await setup();
    await expect(registry.connect(outsider).finalizeSession(receipt, signature))
      .to.be.revertedWithCustomError(registry, 'InvalidDriver')
      .withArgs(outsider.address, receipt.driver);
  });

  it('rejects tampering and an unauthorized device signature', async function () {
    const { driver, registry, receipt, signature, ethers } = await setup();
    const tampered = { ...receipt, energyWh: receipt.energyWh + 1n };
    await expect(registry.connect(driver).finalizeSession(tampered, signature)).to.be.revertedWithCustomError(
      registry,
      'InvalidAmount',
    );
    await expect(
      registry.connect(driver).finalizeSession({ ...receipt, energyWh: 0n, finalAmount: 0n }, signature),
    ).to.be.revertedWithCustomError(registry, 'InvalidEnergy');

    const attackerSignature = await ethers.Wallet.createRandom().signTypedData(
      {
        name: 'ChargeProof Device Receipt',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await registry.getAddress(),
      },
      receiptTypes,
      receipt,
    );
    await expect(
      registry.connect(driver).finalizeSession(receipt, attackerSignature),
    ).to.be.revertedWithCustomError(registry, 'InvalidDeviceSignature');
  });

  it('rejects duplicate sessions and device nonces', async function () {
    const { driver, device, ethers, registry, receipt, signature } = await setup();
    await registry.connect(driver).finalizeSession(receipt, signature);
    await expect(registry.connect(driver).finalizeSession(receipt, signature)).to.be.revertedWithCustomError(
      registry,
      'DuplicateSession',
    );

    const reusedNonce = {
      ...receipt,
      startedAt: receipt.startedAt + 1n,
      endedAt: receipt.endedAt + 1n,
    };
    reusedNonce.sessionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'uint64', 'uint64'],
        [intentId, stationId, driver.address, reusedNonce.startedAt, reusedNonce.nonce],
      ),
    );
    const reusedNonceSignature = await device.signTypedData(
      {
        name: 'ChargeProof Device Receipt',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await registry.getAddress(),
      },
      receiptTypes,
      reusedNonce,
    );
    await expect(
      registry.connect(driver).finalizeSession(reusedNonce, reusedNonceSignature),
    ).to.be.revertedWithCustomError(registry, 'DuplicateDeviceNonce');
  });

  it('restricts station configuration to the owner', async function () {
    const { outsider, registry, device } = await setup();
    await expect(
      registry.connect(outsider).configureStation(stationId, device.address, true, ''),
    ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');
  });
});
