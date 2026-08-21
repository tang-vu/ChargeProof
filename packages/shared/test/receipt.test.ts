import { describe, expect, it } from 'vitest';

import { calculateFinalAmount, calculateSessionId } from '../src/receipt.js';

describe('receipt math', () => {
  it('uses exact ceiling micro-USDC arithmetic without floating point', () => {
    expect(calculateFinalAmount(4_200n, 350_000n)).toBe(1_470_000n);
    expect(calculateFinalAmount(1n, 1n)).toBe(1n);
  });

  it('preserves ceiling bounds across deterministic property samples', () => {
    let seed = 0x4348_4152_4745_5052n;
    for (let index = 0; index < 1_000; index += 1) {
      seed = (seed * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) & ((1n << 64n) - 1n);
      const energyWh = seed % 1_000_000_000n;
      seed = (seed * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) & ((1n << 64n) - 1n);
      const tariff = seed % 1_000_000_000n;
      const product = energyWh * tariff;
      const amount = calculateFinalAmount(energyWh, tariff);

      expect(amount * 1_000n).toBeGreaterThanOrEqual(product);
      if (amount > 0n) expect((amount - 1n) * 1_000n).toBeLessThan(product);
    }
  });

  it('creates deterministic, intent-bound session IDs', () => {
    const first = calculateSessionId(
      `0x${'11'.repeat(32)}`,
      `0x${'22'.repeat(32)}`,
      '0x3333333333333333333333333333333333333333',
      100n,
      7n,
    );
    const second = calculateSessionId(
      `0x${'11'.repeat(32)}`,
      `0x${'22'.repeat(32)}`,
      '0x3333333333333333333333333333333333333333',
      100n,
      8n,
    );
    expect(first).not.toBe(second);
    expect(first).toHaveLength(66);
  });
});
