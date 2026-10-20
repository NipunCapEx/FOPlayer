import { describe, expect, it } from 'vitest';
import {
  assessRisk,
  InvalidRiskInputError,
  type SupportedSymbol,
} from '../src/risk-engine.js';

const symbol: SupportedSymbol = 'RELIANCE';
const assess = (spotPrice: number) =>
  assessRisk({ symbol, entryPrice: 1_000, spotPrice });

describe('assessRisk — business outcomes', () => {
  it('calculates the agreed structural boundaries from entry price', () => {
    const result = assess(1_000);
    expect(result.lowerBoundary).toBe(880);
    expect(result.upperBoundary).toBeCloseTo(1_120);
    expect(result.movementPercent).toBe(0);
    expect(result.level).toBe('normal');
  });

  it.each([
    [1_079, 7.9, 'normal'],
    [1_080, 8, 'caution'],
    [1_099, 9.9, 'caution'],
    [1_100, 10, 'critical'],
    [1_119, 11.9, 'critical'],
    [1_120, 12, 'breached'],
    [1_121, 12.1, 'breached'],
    [921, -7.9, 'normal'],
    [920, -8, 'caution'],
    [901, -9.9, 'caution'],
    [900, -10, 'critical'],
    [881, -11.9, 'critical'],
    [880, -12, 'breached'],
    [879, -12.1, 'breached'],
  ] as const)(
    'maps spot %s to movement %s%% and risk level %s',
    (spot, expectedMovement, expectedLevel) => {
      const result = assess(spot);
      expect(result.movementPercent).toBeCloseTo(expectedMovement);
      expect(result.level).toBe(expectedLevel);
    },
  );

  it('distinguishes movement from boundary distance', () => {
    const result = assess(1_050);
    expect(result.movementPercent).toBeCloseTo(5);
    expect(result.lowerBoundaryDistancePercent).toBeCloseTo(
      ((1_050 - 880) / 1_050) * 100,
    );
    expect(result.upperBoundaryDistancePercent).toBeCloseTo(
      ((1_120 - 1_050) / 1_050) * 100,
    );
    expect(result.upperBoundaryDistancePercent).not.toBe(
      result.movementPercent,
    );
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    undefined as unknown as number,
    null as unknown as number,
  ])(
    'rejects invalid spot price %s instead of showing normal risk',
    (spotPrice) => {
      expect(() => assess(spotPrice)).toThrow(InvalidRiskInputError);
    },
  );

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    undefined as unknown as number,
    null as unknown as number,
  ])('rejects invalid entry price %s', (entryPrice) => {
    expect(() =>
      assessRisk({ symbol, entryPrice, spotPrice: 1_000 }),
    ).toThrow(InvalidRiskInputError);
  });

  it('supports every symbol in the approved MVP scope', () => {
    for (const supportedSymbol of [
      'RELIANCE',
      'JSWSTEEL',
      'BHARTIARTL',
      'SBICARD',
    ] as const) {
      expect(
        assessRisk({
          symbol: supportedSymbol,
          entryPrice: 1_000,
          spotPrice: 1_000,
        }).symbol,
      ).toBe(supportedSymbol);
    }
  });

  it('rejects unsupported symbols at runtime', () => {
    expect(() =>
      assessRisk({
        symbol: 'UNKNOWN' as SupportedSymbol,
        entryPrice: 1_000,
        spotPrice: 1_000,
      }),
    ).toThrow('symbol is not supported');
  });
});
