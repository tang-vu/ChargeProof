import { Wallet } from 'ethers';
import { NextResponse } from 'next/server';
import { getAddress, isAddress, isHash } from 'viem';
import { z } from 'zod';

import {
  calculateFinalAmount,
  calculateSessionId,
  DEMO_MAX_PAYMENT,
  DEMO_STATION_ID,
  DEMO_TARIFF,
  DEMO_TARGET_ENERGY_WH,
  deviceReceiptDigest,
  deviceReceiptTypedData,
  type ChargingReceipt,
} from '@chargeproof/shared';

const requestSchema = z.object({
  sourceRegistry: z.string(),
  receipt: z.object({
    intentId: z.string(),
    sessionId: z.string(),
    stationId: z.string(),
    driver: z.string(),
    startedAt: z.string().regex(/^\d+$/),
    endedAt: z.string().regex(/^\d+$/),
    energyWh: z.string().regex(/^\d+$/),
    tariff: z.string().regex(/^\d+$/),
    finalAmount: z.string().regex(/^\d+$/),
    nonce: z.string().regex(/^\d+$/),
  }),
});

export async function POST(request: Request) {
  const privateKey = process.env.DEVICE_SIMULATOR_PRIVATE_KEY;
  const configuredRegistry = process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS;
  const configuredSigner = process.env.DEVICE_SIGNER_ADDRESS;
  if (!privateKey || !configuredRegistry || !configuredSigner) {
    return NextResponse.json(
      {
        error: 'DEVICE_SIGNER_UNAVAILABLE',
        message: 'The server-side demo device signer is not configured.',
      },
      { status: 503 },
    );
  }

  try {
    const parsed = requestSchema.parse(await request.json());
    if (
      !isAddress(parsed.sourceRegistry) ||
      !isAddress(parsed.receipt.driver) ||
      !isAddress(configuredRegistry) ||
      !isAddress(configuredSigner)
    ) {
      throw new Error('Invalid address');
    }
    if (getAddress(parsed.sourceRegistry) !== getAddress(configuredRegistry)) {
      throw new Error('Source registry is not the configured canonical contract');
    }
    if (
      !isHash(parsed.receipt.intentId) ||
      !isHash(parsed.receipt.sessionId) ||
      !isHash(parsed.receipt.stationId)
    ) {
      throw new Error('Invalid bytes32 identifier');
    }

    const receipt: ChargingReceipt = {
      intentId: parsed.receipt.intentId,
      sessionId: parsed.receipt.sessionId,
      stationId: parsed.receipt.stationId,
      driver: getAddress(parsed.receipt.driver),
      startedAt: BigInt(parsed.receipt.startedAt),
      endedAt: BigInt(parsed.receipt.endedAt),
      energyWh: BigInt(parsed.receipt.energyWh),
      tariff: BigInt(parsed.receipt.tariff),
      finalAmount: BigInt(parsed.receipt.finalAmount),
      nonce: BigInt(parsed.receipt.nonce),
    };
    if (receipt.stationId.toLowerCase() !== DEMO_STATION_ID.toLowerCase()) {
      throw new Error('Station is not the configured hardware simulator');
    }
    if (receipt.tariff !== DEMO_TARIFF) throw new Error('Tariff does not match the demo station');
    if (receipt.energyWh === 0n || receipt.energyWh > DEMO_TARGET_ENERGY_WH) {
      throw new Error('Energy is outside the demo station range');
    }
    if (receipt.endedAt < receipt.startedAt || receipt.endedAt - receipt.startedAt > 86_400n) {
      throw new Error('Invalid session window');
    }
    const currentTime = BigInt(Math.floor(Date.now() / 1_000));
    if (receipt.endedAt > currentTime + 300n || receipt.endedAt + 300n < currentTime) {
      throw new Error('Receipt end time is outside the device clock window');
    }
    if (receipt.finalAmount !== calculateFinalAmount(receipt.energyWh, receipt.tariff)) {
      throw new Error('Final amount does not match metered energy and tariff');
    }
    if (receipt.finalAmount > DEMO_MAX_PAYMENT) throw new Error('Final amount exceeds demo escrow');
    const expectedSessionId = calculateSessionId(
      receipt.intentId,
      receipt.stationId,
      receipt.driver,
      receipt.startedAt,
      receipt.nonce,
    );
    if (expectedSessionId.toLowerCase() !== receipt.sessionId.toLowerCase()) {
      throw new Error('Session ID is not deterministic');
    }

    const wallet = new Wallet(privateKey);
    if (getAddress(wallet.address) !== getAddress(configuredSigner)) {
      throw new Error('Configured device signer does not match the server key');
    }
    const sourceRegistry = getAddress(parsed.sourceRegistry);
    const typedData = deviceReceiptTypedData(sourceRegistry, receipt);
    const mutableTypes = { ChargingReceipt: [...typedData.types.ChargingReceipt] };
    const signature = await wallet.signTypedData(typedData.domain, mutableTypes, typedData.message);
    return NextResponse.json({
      signer: wallet.address,
      signature,
      digest: deviceReceiptDigest(sourceRegistry, receipt),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid receipt';
    return NextResponse.json({ error: 'INVALID_DEVICE_RECEIPT', message }, { status: 400 });
  }
}
