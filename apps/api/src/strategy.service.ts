import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SUPPORTED_SYMBOLS,
  type SupportedSymbol,
} from './risk-engine.js';
import {
  FirestoreStrategyStore,
  type StrategyRecord,
} from './firestore-store.js';

export interface CreateStrategyCommand {
  symbol: unknown;
  entryPrice: unknown;
}

export interface UpdateStrategyCommand {
  entryPrice?: unknown;
  active?: unknown;
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
      throw new BadRequestException('entryPrice must be a positive finite number');
    }

    return this.store.createForOwner(ownerUid, {
      symbol: command.symbol as SupportedSymbol,
      entryPrice: command.entryPrice,
      active: true,
    });
  }

  async update(
    ownerUid: string,
    strategyId: string,
    command: UpdateStrategyCommand,
  ): Promise<StrategyRecord> {
    const patch: { entryPrice?: number; active?: boolean } = {};
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

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
