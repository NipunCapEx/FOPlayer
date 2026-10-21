export const SUPPORTED_SYMBOLS = [
  'RELIANCE',
  'JSWSTEEL',
  'BHARTIARTL',
  'SBICARD',
] as const;

export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];
export type RiskLevel = 'normal' | 'caution' | 'critical' | 'breached';

export interface RiskThresholds {
  cautionPercent: number;
  criticalPercent: number;
  breachedPercent: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  cautionPercent: 8,
  criticalPercent: 10,
  breachedPercent: 12,
};

export interface RiskInput {
  symbol: SupportedSymbol;
  entryPrice: number;
  spotPrice: number;
  thresholds?: RiskThresholds;
}

export interface RiskAssessment {
  symbol: SupportedSymbol;
  entryPrice: number;
  spotPrice: number;
  lowerBoundary: number;
  upperBoundary: number;
  movementPercent: number;
  lowerBoundaryDistancePercent: number;
  upperBoundaryDistancePercent: number;
  level: RiskLevel;
}

export class InvalidRiskInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRiskInputError';
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidRiskInputError(
      `${label} must be a positive finite number`,
    );
  }
}

export function assessRisk(input: RiskInput): RiskAssessment {
  if (!SUPPORTED_SYMBOLS.includes(input.symbol)) {
    throw new InvalidRiskInputError('symbol is not supported');
  }
  assertPositiveFinite(input.entryPrice, 'entryPrice');
  assertPositiveFinite(input.spotPrice, 'spotPrice');

  const { entryPrice, spotPrice, symbol } = input;
  const thresholds = input.thresholds ?? DEFAULT_RISK_THRESHOLDS;
  assertPositiveFinite(thresholds.cautionPercent, 'cautionPercent');
  assertPositiveFinite(thresholds.criticalPercent, 'criticalPercent');
  assertPositiveFinite(thresholds.breachedPercent, 'breachedPercent');
  if (
    thresholds.cautionPercent >= thresholds.criticalPercent ||
    thresholds.criticalPercent >= thresholds.breachedPercent ||
    thresholds.breachedPercent >= 100
  ) {
    throw new InvalidRiskInputError(
      'thresholds must increase and breachedPercent must be below 100',
    );
  }
  const lowerBoundary =
    entryPrice * (1 - thresholds.breachedPercent / 100);
  const upperBoundary =
    entryPrice * (1 + thresholds.breachedPercent / 100);
  const movementPercent = ((spotPrice - entryPrice) / entryPrice) * 100;
  const lowerBoundaryDistancePercent =
    ((spotPrice - lowerBoundary) / spotPrice) * 100;
  const upperBoundaryDistancePercent =
    ((upperBoundary - spotPrice) / spotPrice) * 100;

  // Structural breach has precedence over the percentage-based warning levels.
  let level: RiskLevel = 'normal';
  if (Math.abs(movementPercent) >= thresholds.breachedPercent) {
    // Compare the percentage at the exact threshold to avoid float drift in E * 1.12.
    level = 'breached';
  } else if (Math.abs(movementPercent) >= thresholds.criticalPercent) {
    level = 'critical';
  } else if (Math.abs(movementPercent) >= thresholds.cautionPercent) {
    level = 'caution';
  }

  return {
    symbol,
    entryPrice,
    spotPrice,
    lowerBoundary,
    upperBoundary,
    movementPercent,
    lowerBoundaryDistancePercent,
    upperBoundaryDistancePercent,
    level,
  };
}
