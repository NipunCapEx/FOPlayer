import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap } from '../src/main.js';

describe('bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PORT;
  });

  it('creates the app, enables shutdown hooks and listens on the configured port', async () => {
    const app = {
      enableShutdownHooks: vi.fn(),
      listen: vi.fn(async () => undefined),
    };
    vi.spyOn(NestFactory, 'create').mockResolvedValue(app as never);
    process.env.PORT = '4100';

    await bootstrap();

    expect(NestFactory.create).toHaveBeenCalledOnce();
    expect(app.enableShutdownHooks).toHaveBeenCalledOnce();
    expect(app.listen).toHaveBeenCalledWith(4100, '0.0.0.0');
  });

  it('falls back to port 3000 for an invalid port value', async () => {
    const app = {
      enableShutdownHooks: vi.fn(),
      listen: vi.fn(async () => undefined),
    };
    vi.spyOn(NestFactory, 'create').mockResolvedValue(app as never);
    process.env.PORT = 'invalid';

    await bootstrap();

    expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
  });
});
