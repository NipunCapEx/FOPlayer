import { describe, expect, it, vi } from 'vitest';
import {
  FcmHttpSender,
  FcmTransport,
  MultiChannelDispatcher,
  TelegramTransport,
} from '../src/notifications.js';
import type { RiskAlert } from '../src/monitoring.js';

const alert: RiskAlert = {
  idempotencyKey: 'risk:strategy-1:caution:2026-10-20T10:00:00.000Z',
  strategyId: 'strategy-1',
  symbol: 'RELIANCE',
  kind: 'caution',
  message: 'RELIANCE caution: movement +8.00% from entry.',
  price: 1080,
  movementPercent: 8,
  createdAt: new Date('2026-10-20T10:00:00.000Z'),
};

describe('TelegramTransport', () => {
  it('sends a message without exposing the token in the payload', async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const transport = new TelegramTransport(
      { botToken: 'test-token', chatId: 'test-chat' },
      request as typeof fetch,
    );

    await transport.send(alert);

    expect(request).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      chat_id: 'test-chat',
      text: alert.message,
    });
  });

  it('rejects missing Telegram configuration before making a request', async () => {
    const request = vi.fn(async () => new Response('{}', { status: 200 }));
    const transport = new TelegramTransport(
      { botToken: '', chatId: '' },
      request as typeof fetch,
    );

    await expect(transport.send(alert)).rejects.toThrow(
      'Telegram bot token and chat ID are required',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a Telegram API response that does not confirm delivery', async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: false }), { status: 200 }),
    );
    const transport = new TelegramTransport(
      { botToken: 'test-token', chatId: 'test-chat' },
      request as typeof fetch,
    );

    await expect(transport.send(alert)).rejects.toThrow(
      'Telegram API did not confirm delivery',
    );
  });

  it('surfaces provider HTTP errors for retry handling', async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('unavailable', { status: 503 }),
    );
    const transport = new TelegramTransport(
      { botToken: 'test-token', chatId: 'test-chat' },
      request as typeof fetch,
    );

    await expect(transport.send(alert)).rejects.toThrow('HTTP 503');
  });
});

describe('FcmHttpSender', () => {
  it('uses an injected server access token and sends the FCM v1 payload', async () => {
    const request = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ name: 'projects/test/messages/123' }), {
          status: 200,
        }),
    );
    const sender = new FcmHttpSender(
      'test-project',
      { getAccessToken: async () => 'server-access-token' },
      request as typeof fetch,
    );

    await sender.sendMessage({
      token: 'device-token',
      title: 'RELIANCE: caution',
      body: alert.message,
      data: { alertId: alert.idempotencyKey },
    });

    expect(request).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/v1/projects/test-project/messages:send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer server-access-token',
        }),
      }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      message: {
        token: 'device-token',
        data: { alertId: alert.idempotencyKey },
      },
    });
  });
  it('surfaces FCM HTTP errors for outbox retry', async () => {
    const sender = new FcmHttpSender(
      'test-project',
      { getAccessToken: async () => 'server-access-token' },
      vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response('unavailable', { status: 503 }),
      ) as typeof fetch,
    );

    await expect(
      sender.sendMessage({
        token: 'device-token',
        title: 'RELIANCE: caution',
        body: alert.message,
        data: { alertId: alert.idempotencyKey },
      }),
    ).rejects.toThrow('FCM delivery failed with HTTP 503');
  });

  it('requires server-side Firebase project and access token configuration', async () => {
    const request = vi.fn(async () => new Response('{}', { status: 200 }));
    const missingProject = new FcmHttpSender(
      '',
      { getAccessToken: async () => 'token' },
      request as typeof fetch,
    );
    await expect(
      missingProject.sendMessage({
        token: 'device-token',
        title: 'title',
        body: 'body',
        data: {},
      }),
    ).rejects.toThrow('Firebase project ID is required');

    const missingToken = new FcmHttpSender(
      'test-project',
      { getAccessToken: async () => '' },
      request as typeof fetch,
    );
    await expect(
      missingToken.sendMessage({
        token: 'device-token',
        title: 'title',
        body: 'body',
        data: {},
      }),
    ).rejects.toThrow('Firebase access token is required');
  });
});

describe('FcmTransport', () => {
  it('sends to registered devices and includes a stable alert identifier', async () => {
    const sendMessage = vi.fn(async () => {});
    const transport = new FcmTransport({ sendMessage }, async () => [
      'device-1',
    ]);

    await transport.send(alert);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'device-1',
        data: expect.objectContaining({ alertId: alert.idempotencyKey }),
      }),
    );
  });

  it('retries only failed device tokens', async () => {
    const sendMessage = vi
      .fn(
        async (_input: {
          token: string;
          title: string;
          body: string;
          data: Record<string, string>;
        }) => {},
      )
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary device failure'))
      .mockResolvedValueOnce(undefined);
    const transport = new FcmTransport({ sendMessage }, async () => [
      'device-1',
      'device-2',
    ]);

    await expect(transport.send(alert)).rejects.toThrow(
      'one or more registered devices',
    );
    await transport.send(alert);

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage.mock.calls.map(([input]) => input.token)).toEqual([
      'device-1',
      'device-2',
      'device-2',
    ]);
  });

  it('fails clearly when no device is registered', async () => {
    const transport = new FcmTransport(
      { sendMessage: vi.fn(async () => {}) },
      async () => [],
    );

    await expect(transport.send(alert)).rejects.toThrow(
      'No registered FCM device token',
    );
  });
});

describe('MultiChannelDispatcher', () => {
  it('retries failed channels without duplicating successful delivery', async () => {
    const telegram = { send: vi.fn(async () => {}) };
    const fcm = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('FCM unavailable'))
        .mockResolvedValueOnce(undefined),
    };
    const dispatcher = new MultiChannelDispatcher([telegram, fcm]);

    await expect(dispatcher.dispatch(alert)).rejects.toThrow(
      'One or more notification channels failed',
    );
    await dispatcher.dispatch(alert);

    expect(telegram.send).toHaveBeenCalledOnce();
    expect(fcm.send).toHaveBeenCalledTimes(2);
  });

  it('reports failure when every channel fails', async () => {
    const dispatcher = new MultiChannelDispatcher([
      {
        send: vi.fn(async () => {
          throw new Error('Telegram down');
        }),
      },
      {
        send: vi.fn(async () => {
          throw new Error('FCM down');
        }),
      },
    ]);

    await expect(dispatcher.dispatch(alert)).rejects.toThrow(
      'One or more notification channels failed',
    );
  });

  it('fails closed when no channels are configured', async () => {
    const dispatcher = new MultiChannelDispatcher([]);
    await expect(dispatcher.dispatch(alert)).rejects.toThrow(
      'No notification channels are configured',
    );
  });
});
