import { Wallet, verifyTypedData } from 'ethers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  calculateFinalAmount,
  calculateSessionId,
  DEMO_STATION_ID,
  DEMO_TARIFF,
  deviceReceiptTypedData,
  type ChargingReceipt,
} from '@chargeproof/shared';

import { POST } from './route';

const sourceRegistry = '0x1111111111111111111111111111111111111111';
const driver = '0x2222222222222222222222222222222222222222';
const intentId = `0x${'33'.repeat(32)}` as const;
const stationId = DEMO_STATION_ID;

describe('device signer route', () => {
  beforeEach(() => {
    delete process.env.DEVICE_SIMULATOR_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS;
    delete process.env.DEVICE_SIGNER_ADDRESS;
  });

  it('fails closed when the server-only burner is not configured', async () => {
    const response = await POST(new Request('http://localhost/api/device/sign', { method: 'POST' }));
    expect(response.status).toBe(503);
  });

  it('signs only a deterministic receipt with exact metering math', async () => {
    const signer = Wallet.createRandom();
    process.env.DEVICE_SIMULATOR_PRIVATE_KEY = signer.privateKey;
    process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS = sourceRegistry;
    process.env.DEVICE_SIGNER_ADDRESS = signer.address;
    const startedAt = BigInt(Math.floor(Date.now() / 1_000) - 300);
    const nonce = 9n;
    const energyWh = 4_200n;
    const tariff = DEMO_TARIFF;
    const receipt: ChargingReceipt = {
      intentId,
      sessionId: calculateSessionId(intentId, stationId, driver, startedAt, nonce),
      stationId,
      driver,
      startedAt,
      endedAt: startedAt + 300n,
      energyWh,
      tariff,
      finalAmount: calculateFinalAmount(energyWh, tariff),
      nonce,
    };
    const serializable = Object.fromEntries(
      Object.entries(receipt).map(([key, value]) => [
        key,
        typeof value === 'bigint' ? value.toString() : value,
      ]),
    );
    const response = await POST(
      new Request('http://localhost/api/device/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceRegistry, receipt: serializable }),
      }),
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { signature: string; signer: string };
    const typedData = deviceReceiptTypedData(sourceRegistry, receipt);
    expect(
      verifyTypedData(
        typedData.domain,
        { ChargingReceipt: [...typedData.types.ChargingReceipt] },
        typedData.message,
        result.signature,
      ),
    ).toBe(signer.address);
    expect(result.signer).toBe(signer.address);

    const wrongRegistry = await POST(
      new Request('http://localhost/api/device/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRegistry: '0x9999999999999999999999999999999999999999',
          receipt: serializable,
        }),
      }),
    );
    expect(wrongRegistry.status).toBe(400);

    const wrongTariff = await POST(
      new Request('http://localhost/api/device/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRegistry,
          receipt: { ...serializable, tariff: (DEMO_TARIFF + 1n).toString() },
        }),
      }),
    );
    expect(wrongTariff.status).toBe(400);
  });
});
