import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StrategiesController } from '../src/strategies.controller.js';
import type { AuthenticatedRequest } from '../src/firebase-auth.guard.js';
import type { StrategyService } from '../src/strategy.service.js';

function createController() {
  const service = {
    dashboard: vi.fn(async (uid: string) => ({ ownerUid: uid })),
    list: vi.fn(async (uid: string) => [{ ownerUid: uid }]),
    create: vi.fn(async (uid: string, body: unknown) => ({
      ownerUid: uid,
      body,
    })),
    update: vi.fn(async (uid: string, id: string, body: unknown) => ({
      ownerUid: uid,
      id,
      body,
    })),
    alerts: vi.fn(async (uid: string) => [{ ownerUid: uid }]),
    registerDevice: vi.fn(
      async (uid: string, strategyId: unknown, token: unknown) => ({
        uid,
        strategyId,
        token,
      }),
    ),
  };
  return {
    controller: new StrategiesController(service as unknown as StrategyService),
    service,
  };
}

const request: AuthenticatedRequest = {
  headers: {},
  user: { uid: 'verified-user' },
};

describe('StrategiesController', () => {
  it('forwards only the verified UID to owner-scoped read methods', async () => {
    const { controller, service } = createController();

    await expect(controller.getDashboard(request)).resolves.toEqual({
      ownerUid: 'verified-user',
    });
    await expect(controller.listStrategies(request)).resolves.toEqual([
      { ownerUid: 'verified-user' },
    ]);
    await expect(controller.listAlerts(request)).resolves.toEqual([
      { ownerUid: 'verified-user' },
    ]);
    expect(service.dashboard).toHaveBeenCalledWith('verified-user');
    expect(service.list).toHaveBeenCalledWith('verified-user');
    expect(service.alerts).toHaveBeenCalledWith('verified-user');
  });

  it('rejects non-object request bodies', async () => {
    const { controller, service } = createController();

    expect(() => controller.createStrategy(request, null)).toThrow(
      BadRequestException,
    );
    expect(() => controller.updateStrategy(request, 'strategy-1', [])).toThrow(
      BadRequestException,
    );
    expect(() => controller.registerDevice(request, null)).toThrow(
      BadRequestException,
    );
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('forwards whitelisted strategy fields and device registration fields', async () => {
    const { controller, service } = createController();

    await controller.createStrategy(request, {
      symbol: 'RELIANCE',
      entryPrice: 1000,
      ownerUid: 'attacker',
    });
    expect(service.create).toHaveBeenCalledWith('verified-user', {
      symbol: 'RELIANCE',
      entryPrice: 1000,
    });

    await controller.updateStrategy(request, 'strategy-1', {
      active: false,
      ownerUid: 'attacker',
    });
    expect(service.update).toHaveBeenCalledWith('verified-user', 'strategy-1', {
      active: false,
    });

    await controller.registerDevice(request, {
      strategyId: 'strategy-1',
      token: 'f'.repeat(32),
    });
    expect(service.registerDevice).toHaveBeenCalledWith(
      'verified-user',
      'strategy-1',
      'f'.repeat(32),
    );
  });

  it('rejects calls without verified user context', async () => {
    const { controller } = createController();
    expect(() => controller.listStrategies({ headers: {} })).toThrow(
      UnauthorizedException,
    );
  });
});
