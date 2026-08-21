import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem';

import { SEPOLIA_CHAIN_ID } from './networks.js';

export const DEVICE_RECEIPT_DOMAIN_NAME = 'ChargeProof Device Receipt';
export const DEVICE_RECEIPT_DOMAIN_VERSION = '1';

export type ChargingReceipt = {
  intentId: Hex;
  sessionId: Hex;
  stationId: Hex;
  driver: Address;
  startedAt: bigint;
  endedAt: bigint;
  energyWh: bigint;
  tariff: bigint;
  finalAmount: bigint;
  nonce: bigint;
};

export const chargingReceiptTypes = {
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
} as const;

export function calculateFinalAmount(energyWh: bigint, tariff: bigint): bigint {
  if (energyWh < 0n || tariff < 0n) throw new Error('Energy and tariff must be non-negative');
  return (energyWh * tariff + 999n) / 1_000n;
}

export function calculateSessionId(
  intentId: Hex,
  stationId: Hex,
  driver: Address,
  startedAt: bigint,
  nonce: bigint,
): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32,bytes32,address,uint64,uint64'), [
      intentId,
      stationId,
      driver,
      startedAt,
      nonce,
    ]),
  );
}

export function deviceReceiptTypedData(sourceRegistry: Address, receipt: ChargingReceipt) {
  return {
    domain: {
      name: DEVICE_RECEIPT_DOMAIN_NAME,
      version: DEVICE_RECEIPT_DOMAIN_VERSION,
      chainId: SEPOLIA_CHAIN_ID,
      verifyingContract: sourceRegistry,
    },
    types: chargingReceiptTypes,
    primaryType: 'ChargingReceipt' as const,
    message: receipt,
  } as const;
}

export function deviceReceiptDigest(sourceRegistry: Address, receipt: ChargingReceipt): Hex {
  return hashTypedData(deviceReceiptTypedData(sourceRegistry, receipt));
}
