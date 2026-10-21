import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StrategyService } from '../src/strategy.service.js';
import type { FirestoreStrategyStore } from '../src/firestore-store.js';

function createService() {
  const store = {
    listForOwner: vi.fn(async () => []),
    getDashboard: vi.fn(async () => ({
      strategies: [],
      snapshots: [],
      alerts: [],
    })),
    createForOwner: vi.fn(async (ownerUid, input) => ({
      id: 'strategy-1',
      ownerUid,
      ...input,
      createdAt: new Date('2026-10-20T10:00:00Z'),
      updatedAt: new Date('2026-10-20T10:00:00Z'),
    })),
    updateForOwner: vi.fn(async (ownerUid, id, input) => ({
      id,
      ownerUid,
      symbol: 'RELIANCE' as const,
      entryPrice: input.entryPrice ?? 100,
      active: input.active ?? true,
      createdAt: new Date('2026-10-20T10:00:00Z'),
      updatedAt: new Date('2026-10-20T10:00:00Z'),
    })),
    registerDeviceToken: vi.fn(async () => true),
    listAlertsForOwner: vi.fn(async () => []),
  };
  return {
    service: new StrategyService(store as unknown as FirestoreStrategyStore),
    store,
  };
}

describe('StrategyService', () => {
  it('creates a supported strategy only with a positive finite entry', async () => {
    const { service, store } = createService();
    await expect(
      service.create('owner-1', { symbol: 'RELIANCE', entryPrice: 1250 }),
    ).resolves.toMatchObject({
      ownerUid: 'owner-1',
      symbol: 'RELIANCE',
      entryPrice: 1250,
      active: true,
    });
    expect(store.createForOwner).toHaveBeenCalledWith('owner-1', {
      symbol: 'RELIANCE',
      entryPrice: 1250,
      active: true,
    });

    await expect(
      service.create('owner-1', { symbol: 'UNKNOWN', entryPrice: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    for (const entryPrice of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        service.create('owner-1', { symbol: 'RELIANCE', entryPrice }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('validates update fields and rejects an empty patch', async () => {
    const { service, store } = createService();
    await expect(
      service.update('owner-1', 'strategy-1', {
        entryPrice: 1500,
        active: false,
      }),
    ).resolves.toMatchObject({ entryPrice: 1500, active: false });
    await expect(
      service.update('owner-1', 'strategy-1', { entryPrice: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('owner-1', 'strategy-1', { active: 'false' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('owner-1', 'strategy-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.updateForOwner).toHaveBeenCalledTimes(1);
  });

  it('returns not found when a strategy is not owned by the caller', async () => {
    const { service, store } = createService();
    store.updateForOwner.mockResolvedValueOnce(null as never);

    await expect(
      service.update('another-user', 'strategy-1', { active: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates device-token registration and delegates owner scoping to the store', async () => {
    const { service, store } = createService();
    await expect(
      service.registerDevice('owner-1', 'strategy-1', 'f'.repeat(32)),
    ).resolves.toEqual({ registered: true });
    expect(store.registerDeviceToken).toHaveBeenCalledWith(
      'owner-1',
      'strategy-1',
      'f'.repeat(32),
    );
    await expect(
      service.registerDevice('owner-1', '', 'f'.repeat(32)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.registerDevice('owner-1', 'strategy-1', 'short'),
    ).rejects.toBeInstanceOf(BadRequestException);
    store.registerDeviceToken.mockResolvedValueOnce(false);
    await expect(
      service.registerDevice('owner-1', 'foreign-strategy', 'f'.repeat(32)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
