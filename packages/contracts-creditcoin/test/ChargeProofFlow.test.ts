import { expect } from 'chai';
import { network } from 'hardhat';

import type {
  AttestcoinChargeVerifier,
  ChargeIntentEscrow,
  MockUSDC,
  StationRegistry,
} from '../types/ethers-contracts/index.js';
import type { AdversarialERC20 } from '../types/ethers-contracts/test/AdversarialERC20.js';
import type { MockNativeQueryVerifier } from '../types/ethers-contracts/test/MockNativeQueryVerifier.js';

const stationId = `0x${'43'.repeat(32)}`;
const intentId = '0x2222222222222222222222222222222222222222222222222222222222222222';
const sourceChainKey = 1n;
const tariff = 350_000n;
const maxPayment = 5_000_000n;

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

describe('ChargeProof Creditcoin vertical slice', function () {
  async function setup(adversarialToken = false) {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const owner = required(signers[0]);
    const driver = required(signers[1]);
    const payout = required(signers[2]);
    const sourceRegistry = required(signers[3]);
    const outsider = required(signers[4]);
    const device = ethers.Wallet.createRandom();

    const stationRegistry = (await ethers.deployContract('StationRegistry', [
      owner.address,
    ])) as unknown as StationRegistry;
    const tokenDeployment = adversarialToken
      ? await ethers.deployContract('AdversarialERC20')
      : await ethers.deployContract('MockUSDC');
    const token = tokenDeployment as unknown as MockUSDC;
    await Promise.all([stationRegistry.waitForDeployment(), token.waitForDeployment()]);
    const escrow = (await ethers.deployContract('ChargeIntentEscrow', [
      owner.address,
      await token.getAddress(),
      await stationRegistry.getAddress(),
    ])) as unknown as ChargeIntentEscrow;
    const precompile = (await ethers.deployContract(
      'MockNativeQueryVerifier',
    )) as unknown as MockNativeQueryVerifier;
    await Promise.all([escrow.waitForDeployment(), precompile.waitForDeployment()]);
    const verifier = (await ethers.deployContract('AttestcoinChargeVerifier', [
      await escrow.getAddress(),
      await precompile.getAddress(),
      sourceChainKey,
      sourceRegistry.address,
    ])) as unknown as AttestcoinChargeVerifier;
    await verifier.waitForDeployment();

    await stationRegistry.registerStation(
      stationId,
      payout.address,
      device.address,
      'ipfs://chargeproof/station/cp-sgn-001',
    );
    await stationRegistry.setMetricsRecorder(await escrow.getAddress());
    await escrow.setVerifier(await verifier.getAddress());
    await token.connect(driver).faucet();
    await token.connect(driver).approve(await escrow.getAddress(), maxPayment);

    const latest = await ethers.provider.getBlock('latest');
    const now = BigInt(latest?.timestamp ?? 1);
    const expiresAt = now + 3_600n;
    await escrow
      .connect(driver)
      .openIntent(intentId, stationId, maxPayment, tariff, expiresAt, sourceChainKey, sourceRegistry.address);

    const startedAt = now;
    const endedAt = now + 300n;
    const energyWh = 4_200n;
    const finalAmount = (energyWh * tariff + 999n) / 1_000n;
    const nonce = 42n;
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
    const signature = await device.signTypedData(
      {
        name: 'ChargeProof Device Receipt',
        version: '1',
        chainId: 11_155_111,
        verifyingContract: sourceRegistry.address,
      },
      receiptTypes,
      receipt,
    );

    function encodeTransaction(overrides?: {
      from?: string;
      to?: string;
      receiptStatus?: number;
      callData?: string;
      receipt?: typeof receipt;
      deviceSignature?: string;
    }) {
      const sourceInterface = new ethers.Interface([
        'function finalizeSession((bytes32 intentId,bytes32 sessionId,bytes32 stationId,address driver,uint64 startedAt,uint64 endedAt,uint64 energyWh,uint256 tariff,uint256 finalAmount,uint64 nonce) receipt,bytes deviceSignature)',
      ]);
      const callData =
        overrides?.callData ??
        sourceInterface.encodeFunctionData('finalizeSession', [
          overrides?.receipt ?? receipt,
          overrides?.deviceSignature ?? signature,
        ]);
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const commonChunk = coder.encode(
        ['uint64', 'uint64', 'address', 'bool', 'address', 'uint256', 'bytes'],
        [
          9n,
          500_000n,
          overrides?.from ?? driver.address,
          false,
          overrides?.to ?? sourceRegistry.address,
          0n,
          callData,
        ],
      );
      const receiptChunk = coder.encode(
        ['uint8', 'uint64', 'tuple(address address_,bytes32[] topics,bytes data)[]', 'bytes'],
        [overrides?.receiptStatus ?? 1, 250_000n, [], '0x'],
      );
      return coder.encode(['uint8', 'bytes[]'], [2, [commonChunk, '0x', receiptChunk]]);
    }

    function proof(encodedTransaction = encodeTransaction(), chainKey = sourceChainKey) {
      return {
        chainKey,
        blockHeight: 11_500_000n,
        encodedTransaction,
        merkleRoot: `0x${'33'.repeat(32)}`,
        siblings: [{ hash: `0x${'44'.repeat(32)}`, isLeft: false }],
        lowerEndpointDigest: `0x${'55'.repeat(32)}`,
        continuityRoots: [`0x${'66'.repeat(32)}`],
      };
    }

    return {
      ethers,
      owner,
      driver,
      payout,
      sourceRegistry,
      outsider,
      device,
      stationRegistry,
      token,
      escrow,
      precompile,
      verifier,
      expiresAt,
      receipt,
      signature,
      encodeTransaction,
      proof,
    };
  }

  it('escrows, verifies, settles, refunds the difference, and records metrics', async function () {
    const { driver, payout, stationRegistry, token, escrow, verifier, receipt, proof } = await setup();

    await expect(verifier.verifyAndSettle(proof())).to.emit(verifier, 'ChargingProofSettled');

    const stored = await escrow.intent(intentId);
    expect(stored.state).to.equal(2n);
    expect(stored.paidAmount).to.equal(receipt.finalAmount);
    expect(stored.refundAmount).to.equal(maxPayment - receipt.finalAmount);
    expect(await escrow.claimable(payout.address)).to.equal(receipt.finalAmount);
    expect(await escrow.claimable(driver.address)).to.equal(maxPayment - receipt.finalAmount);
    expect(await escrow.totalEscrowed()).to.equal(0n);
    expect(await escrow.totalClaimable()).to.equal(maxPayment);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(maxPayment);

    const station = await stationRegistry.station(stationId);
    expect(station.completedSessions).to.equal(1n);
    expect(station.successfulSettlements).to.equal(1n);
    expect(station.totalEnergyWh).to.equal(receipt.energyWh);
    expect(station.totalValueSettled).to.equal(receipt.finalAmount);

    await escrow.connect(payout).withdrawClaim(payout.address);
    await escrow.connect(driver).withdrawClaim(driver.address);
    expect(await token.balanceOf(payout.address)).to.equal(receipt.finalAmount);
    expect(await escrow.totalClaimable()).to.equal(0n);
  });

  it('rejects invalid and malformed Attestcoin proofs', async function () {
    const { precompile, verifier, proof } = await setup();
    await precompile.configure(false, false, 7);
    await expect(verifier.verifyAndSettle(proof())).to.be.revertedWithCustomError(verifier, 'InvalidProof');
    await precompile.configure(true, true, 7);
    await expect(verifier.verifyAndSettle(proof())).to.be.revertedWith('mock malformed proof');
  });

  it('rejects the wrong chain, source contract, sender, selector, and failed source receipt', async function () {
    const { outsider, verifier, encodeTransaction, proof } = await setup();
    await expect(verifier.verifyAndSettle(proof(undefined, 2n))).to.be.revertedWithCustomError(
      verifier,
      'IncorrectSourceChain',
    );
    await expect(
      verifier.verifyAndSettle(proof(encodeTransaction({ to: outsider.address }))),
    ).to.be.revertedWithCustomError(verifier, 'IncorrectSourceContract');
    await expect(
      verifier.verifyAndSettle(proof(encodeTransaction({ from: outsider.address }))),
    ).to.be.revertedWithCustomError(verifier, 'IncorrectDriver');
    await expect(
      verifier.verifyAndSettle(proof(encodeTransaction({ callData: '0x12345678' }))),
    ).to.be.revertedWithCustomError(verifier, 'IncorrectFunctionSelector');
    await expect(
      verifier.verifyAndSettle(proof(encodeTransaction({ receiptStatus: 0 }))),
    ).to.be.revertedWithCustomError(verifier, 'InvalidReceiptStatus');
  });

  it('rejects a tampered receipt and unauthorized device signer', async function () {
    const { ethers, verifier, receipt, signature, proof, sourceRegistry } = await setup();
    const sourceInterface = new ethers.Interface([
      'function finalizeSession((bytes32 intentId,bytes32 sessionId,bytes32 stationId,address driver,uint64 startedAt,uint64 endedAt,uint64 energyWh,uint256 tariff,uint256 finalAmount,uint64 nonce) receipt,bytes deviceSignature)',
    ]);
    const attackerSignature = await ethers.Wallet.createRandom().signTypedData(
      {
        name: 'ChargeProof Device Receipt',
        version: '1',
        chainId: 11_155_111,
        verifyingContract: sourceRegistry.address,
      },
      receiptTypes,
      receipt,
    );
    const callData = sourceInterface.encodeFunctionData('finalizeSession', [receipt, attackerSignature]);

    const coder = ethers.AbiCoder.defaultAbiCoder();
    const common = coder.encode(
      ['uint64', 'uint64', 'address', 'bool', 'address', 'uint256', 'bytes'],
      [1n, 500_000n, receipt.driver, false, sourceRegistry.address, 0n, callData],
    );
    const receiptChunk = coder.encode(
      ['uint8', 'uint64', 'tuple(address address_,bytes32[] topics,bytes data)[]', 'bytes'],
      [1, 1n, [], '0x'],
    );
    const encoded = coder.encode(['uint8', 'bytes[]'], [2, [common, signature.slice(0, 2), receiptChunk]]);
    await expect(verifier.verifyAndSettle(proof(encoded))).to.be.revertedWithCustomError(
      verifier,
      'IncorrectDeviceSigner',
    );
  });

  it('rejects over-limit, station mismatch, expiry breach, and replay', async function () {
    const { ethers, verifier, receipt, proof, encodeTransaction, sourceRegistry, device, expiresAt } =
      await setup();
    const domain = {
      name: 'ChargeProof Device Receipt',
      version: '1',
      chainId: 11_155_111,
      verifyingContract: sourceRegistry.address,
    };

    const overLimit = {
      ...receipt,
      energyWh: 20_000n,
      finalAmount: (20_000n * tariff + 999n) / 1_000n,
    };
    const overLimitSignature = await device.signTypedData(domain, receiptTypes, overLimit);
    await expect(
      verifier.verifyAndSettle(
        proof(encodeTransaction({ receipt: overLimit, deviceSignature: overLimitSignature })),
      ),
    ).to.be.revertedWithCustomError(verifier, 'AmountAboveEscrow');

    const wrongStation = { ...receipt, stationId: `0x${'77'.repeat(32)}` };
    wrongStation.sessionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'uint64', 'uint64'],
        [intentId, wrongStation.stationId, receipt.driver, receipt.startedAt, receipt.nonce],
      ),
    );
    const wrongStationSignature = await device.signTypedData(domain, receiptTypes, wrongStation);
    await expect(
      verifier.verifyAndSettle(
        proof(encodeTransaction({ receipt: wrongStation, deviceSignature: wrongStationSignature })),
      ),
    ).to.be.revertedWithCustomError(verifier, 'IncorrectStation');

    const zeroEnergy = { ...receipt, energyWh: 0n, finalAmount: 0n };
    const zeroEnergySignature = await device.signTypedData(domain, receiptTypes, zeroEnergy);
    await expect(
      verifier.verifyAndSettle(
        proof(encodeTransaction({ receipt: zeroEnergy, deviceSignature: zeroEnergySignature })),
      ),
    ).to.be.revertedWithCustomError(verifier, 'InvalidEnergy');

    const beforeIntent = {
      ...receipt,
      startedAt: receipt.startedAt - 301n,
      endedAt: receipt.startedAt - 300n,
    };
    beforeIntent.sessionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'uint64', 'uint64'],
        [intentId, stationId, receipt.driver, beforeIntent.startedAt, receipt.nonce],
      ),
    );
    const beforeIntentSignature = await device.signTypedData(domain, receiptTypes, beforeIntent);
    await expect(
      verifier.verifyAndSettle(
        proof(encodeTransaction({ receipt: beforeIntent, deviceSignature: beforeIntentSignature })),
      ),
    ).to.be.revertedWithCustomError(verifier, 'SessionStartedBeforeIntent');

    const afterExpiry = {
      ...receipt,
      startedAt: expiresAt - 100n,
      endedAt: expiresAt + 1n,
    };
    afterExpiry.sessionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'address', 'uint64', 'uint64'],
        [intentId, stationId, receipt.driver, afterExpiry.startedAt, receipt.nonce],
      ),
    );
    const afterExpirySignature = await device.signTypedData(domain, receiptTypes, afterExpiry);
    await expect(
      verifier.verifyAndSettle(
        proof(encodeTransaction({ receipt: afterExpiry, deviceSignature: afterExpirySignature })),
      ),
    ).to.be.revertedWithCustomError(verifier, 'SessionEndedAfterExpiry');

    await verifier.verifyAndSettle(proof());
    await expect(verifier.verifyAndSettle(proof())).to.be.revertedWithCustomError(verifier, 'Replay');
  });

  it('revalidates tariff, session identity, and exact metering math', async function () {
    const { verifier, receipt, proof, encodeTransaction, sourceRegistry, device } = await setup();
    const domain = {
      name: 'ChargeProof Device Receipt',
      version: '1',
      chainId: 11_155_111,
      verifyingContract: sourceRegistry.address,
    };

    async function expectReceiptError(
      candidate: typeof receipt,
      customError: 'IncorrectTariff' | 'InvalidSessionId' | 'IncorrectAmount',
    ) {
      const candidateSignature = await device.signTypedData(domain, receiptTypes, candidate);
      await expect(
        verifier.verifyAndSettle(
          proof(encodeTransaction({ receipt: candidate, deviceSignature: candidateSignature })),
        ),
      ).to.be.revertedWithCustomError(verifier, customError);
    }

    await expectReceiptError(
      {
        ...receipt,
        tariff: receipt.tariff + 1n,
        finalAmount: (receipt.energyWh * (receipt.tariff + 1n) + 999n) / 1_000n,
      },
      'IncorrectTariff',
    );
    await expectReceiptError({ ...receipt, sessionId: `0x${'88'.repeat(32)}` }, 'InvalidSessionId');
    await expectReceiptError({ ...receipt, finalAmount: receipt.finalAmount + 1n }, 'IncorrectAmount');
  });

  it('allows only the driver to refund after expiry plus attestation grace', async function () {
    const { ethers, driver, outsider, escrow, expiresAt } = await setup();
    await expect(escrow.connect(outsider).refundExpired(intentId)).to.be.revertedWithCustomError(
      escrow,
      'NotDriver',
    );
    await expect(escrow.connect(driver).refundExpired(intentId)).to.be.revertedWithCustomError(
      escrow,
      'TooEarlyToRefund',
    );

    await ethers.provider.send('evm_setNextBlockTimestamp', [Number(expiresAt + 1_801n)]);
    await ethers.provider.send('evm_mine', []);
    await escrow.connect(driver).refundExpired(intentId);
    const stored = await escrow.intent(intentId);
    expect(stored.state).to.equal(3n);
    expect(await escrow.claimable(driver.address)).to.equal(maxPayment);
    await expect(escrow.connect(driver).refundExpired(intentId)).to.be.revertedWithCustomError(
      escrow,
      'IntentNotOpen',
    );
  });

  it('enforces one-time verifier/metrics wiring and authorization boundaries', async function () {
    const { outsider, stationRegistry, escrow, verifier } = await setup();
    await expect(escrow.setVerifier(await verifier.getAddress())).to.be.revertedWithCustomError(
      escrow,
      'VerifierAlreadySet',
    );
    await expect(stationRegistry.setMetricsRecorder(await escrow.getAddress())).to.be.revertedWithCustomError(
      stationRegistry,
      'MetricsRecorderAlreadySet',
    );
    await expect(
      escrow.connect(outsider).settleVerified({
        intentId,
        sessionId: intentId,
        sourceTransactionKey: intentId,
        stationId,
        driver: outsider.address,
        endedAt: 1,
        energyWh: 1,
        tariff,
        finalAmount: 1,
      }),
    ).to.be.revertedWithCustomError(escrow, 'NotVerifier');
  });

  it('preserves settlement credits across failed transfers and blocks token reentrancy', async function () {
    const { driver, escrow, verifier, token, proof } = await setup(true);
    const adversarial = token as unknown as AdversarialERC20;

    await verifier.verifyAndSettle(proof());
    const expectedClaim = await escrow.claimable(driver.address);
    await adversarial.setFailTransfers(true);
    await expect(escrow.connect(driver).withdrawClaim(driver.address)).to.be.revertedWithCustomError(
      adversarial,
      'ForcedTransferFailure',
    );
    expect(await escrow.claimable(driver.address)).to.equal(expectedClaim);

    await adversarial.setFailTransfers(false);
    const callback = escrow.interface.encodeFunctionData('withdrawClaim', [driver.address]);
    await adversarial.configureReentry(await escrow.getAddress(), callback, true);
    await escrow.connect(driver).withdrawClaim(driver.address);

    expect(await adversarial.reentryAttempted()).to.equal(true);
    expect(await adversarial.reentrySucceeded()).to.equal(false);
    expect(await escrow.claimable(driver.address)).to.equal(0n);
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Hardhat test signer is unavailable');
  return value;
}
