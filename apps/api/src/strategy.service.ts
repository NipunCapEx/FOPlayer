import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_RISK_THRESHOLDS,
  SUPPORTED_SYMBOLS,
  type RiskThresholds,
  type SupportedSymbol,
} from './risk-engine.js';
import {
  FirestoreStrategyStore,
  type StrategyRecord,
} from './firestore-store.js';

export interface CreateStrategyCommand {
  symbol: unknown;
  entryPrice: unknown;
  entryDate?: unknown;
  expiryDate?: unknown;
  thresholds?: unknown;
}

export interface UpdateStrategyCommand {
  entryPrice?: unknown;
  active?: unknown;
  entryDate?: unknown;
  expiryDate?: unknown;
  thresholds?: unknown;
}

@Injectable()
export class StrategyService {
  constructor(private readonly store: FirestoreStrategyStore) {}

  async list(ownerUid: string): Promise<StrategyRecord[]> {
    return this.store.listForOwner(ownerUid);
  }

  async dashboard(ownerUid: string) {
    return this.store.getDashboard(ownerUid);
  }

  async create(
    ownerUid: string,
    command: CreateStrategyCommand,
  ): Promise<StrategyRecord> {
    if (
      typeof command.symbol !== 'string' ||
      !SUPPORTED_SYMBOLS.includes(command.symbol as SupportedSymbol)
    ) {
      throw new BadRequestException('symbol is not supported');
    }
    if (!isPositiveFinite(command.entryPrice)) {
      throw new BadRequestException(
        'entryPrice must be a positive finite number',
      );
    }

    if (command.entryDate !== undefined && !isValidIsoDate(command.entryDate)) {
      throw new BadRequestException(
        'entryDate must be a valid YYYY-MM-DD date',
      );
    }

    if (
      command.expiryDate !== undefined &&
      !isValidIsoDate(command.expiryDate)
    ) {
      throw new BadRequestException(
        'expiryDate must be a valid YYYY-MM-DD date',
      );
    }

    if (
      command.thresholds !== undefined &&
      !isValidThresholds(command.thresholds)
    ) {
      throw new BadRequestException('thresholds are invalid');
    }

    return this.store.createForOwner(ownerUid, {
      symbol: command.symbol as SupportedSymbol,
      entryPrice: command.entryPrice,
      active: true,
      ...(typeof command.entryDate === 'string'
        ? { entryDate: command.entryDate }
        : {}),
      ...(typeof command.expiryDate === 'string'
        ? { expiryDate: command.expiryDate }
        : {}),
      ...(command.thresholds === undefined
        ? {}
        : { thresholds: command.thresholds as RiskThresholds }),
    });
  }

  async update(
    ownerUid: string,
    strategyId: string,
    command: UpdateStrategyCommand,
  ): Promise<StrategyRecord> {
    const patch: {
      entryPrice?: number;
      active?: boolean;
      expiryDate?: string;
      entryDate?: string;
      thresholds?: RiskThresholds;
    } = {};
    if (command.entryPrice !== undefined) {
      if (!isPositiveFinite(command.entryPrice)) {
        throw new BadRequestException(
          'entryPrice must be a positive finite number',
        );
      }
      patch.entryPrice = command.entryPrice;
    }
    if (command.active !== undefined) {
      if (typeof command.active !== 'boolean') {
        throw new BadRequestException('active must be a boolean');
      }
      patch.active = command.active;
    }
    if (command.entryDate !== undefined) {
      if (!isValidIsoDate(command.entryDate)) {
        throw new BadRequestException(
          'entryDate must be a valid YYYY-MM-DD date',
        );
      }
      patch.entryDate = command.entryDate;
    }
    if (command.thresholds !== undefined) {
      if (!isValidThresholds(command.thresholds)) {
        throw new BadRequestException('thresholds are invalid');
      }
      patch.thresholds = command.thresholds;
    }
    if (command.expiryDate !== undefined) {
      if (!isValidIsoDate(command.expiryDate)) {
        throw new BadRequestException(
          'expiryDate must be a valid YYYY-MM-DD date',
        );
      }
      patch.expiryDate = command.expiryDate;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('at least one supported field is required');
    }

    const result = await this.store.updateForOwner(ownerUid, strategyId, patch);
    if (!result) throw new NotFoundException('strategy not found');
    return result;
  }

  async registerDevice(
    ownerUid: string,
    strategyId: unknown,
    token: unknown,
  ): Promise<{ registered: true }> {
    if (typeof strategyId !== 'string' || strategyId.trim().length === 0) {
      throw new BadRequestException('strategyId is required');
    }
    if (
      typeof token !== 'string' ||
      token.trim().length < 20 ||
      token.length > 4096
    ) {
      throw new BadRequestException('token is invalid');
    }
    const registered = await this.store.registerDeviceToken(
      ownerUid,
      strategyId,
      token,
    );
    if (!registered) throw new NotFoundException('strategy not found');
    return { registered: true };
  }

  async alerts(ownerUid: string): Promise<Record<string, unknown>[]> {
    return this.store.listAlertsForOwner(ownerUid);
  }
}

function isValidThresholds(value: unknown): value is RiskThresholds {
  if (!value || typeof value !== 'object') return false;
  const thresholds = value as Partial<RiskThresholds>;
  return (
    isPositiveFinite(thresholds.cautionPercent) &&
    isPositiveFinite(thresholds.criticalPercent) &&
    isPositiveFinite(thresholds.breachedPercent) &&
    thresholds.cautionPercent < thresholds.criticalPercent &&
    thresholds.criticalPercent < thresholds.breachedPercent &&
    thresholds.breachedPercent < 100
  );
}

function isValidIsoDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
