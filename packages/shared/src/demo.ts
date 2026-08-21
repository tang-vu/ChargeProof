import { stringToHex } from 'viem';

export const DEMO_STATION_ID = stringToHex('CP-SGN-001', { size: 32 });
export const DEMO_TARIFF = 350_000n;
export const DEMO_MAX_PAYMENT = 5_000_000n;
export const DEMO_TARGET_ENERGY_WH = 4_200n;
