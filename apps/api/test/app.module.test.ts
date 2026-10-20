import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule, readSpecialSessions } from '../src/app.module.js';
import { FirebaseAdminService } from '../src/firebase-admin.service.js';
import { HealthController } from '../src/health.controller.js';

const keys = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_PROJECT',
  'K_SERVICE',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

it('reports Telegram configured only for a single allowlisted UID', () => {
  const original = new Map(
    ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'FIREBASE_ALLOWED_UIDS'].map(
      (key) => [key, process.env[key]],
    ),
  );
  try {
    process.env.TELEGRAM_BOT_TOKEN = 'server-token';
    process.env.TELEGRAM_CHAT_ID = 'private-chat';
    const controller = new HealthController({
      isConfigured: false,
    } as FirebaseAdminService);

    process.env.FIREBASE_ALLOWED_UIDS = 'user-a,user-b';
    expect(controller.getHealth().telegramConfigured).toBe(false);
    process.env.FIREBASE_ALLOWED_UIDS = 'user-a';
    expect(controller.getHealth().telegramConfigured).toBe(true);
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

describe('AppModule runtime wiring', () => {
  it('boots health-only mode without privileged credentials and never reports secrets', async () => {
    for (const key of keys) delete process.env[key];
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      await app.init();
      expect(
        app.get(FirebaseAdminService, { strict: false }).isConfigured,
      ).toBe(false);
      expect(app.get(HealthController).getHealth()).toEqual({
        status: 'ok',
        service: 'foplayer-api',
        firebaseConfigured: false,
        marketDataAdapter: 'yahoo-finance-prototype',
        telegramConfigured: false,
        androidPushConfigured: false,
      });
    } finally {
      await app.close();
    }
  });
});

describe('special market session configuration', () => {
  it('returns no overrides when the setting is empty', () => {
    expect(readSpecialSessions(undefined)).toEqual({});
    expect(readSpecialSessions('  ')).toEqual({});
  });

  it('parses date-specific open and close times', () => {
    expect(
      readSpecialSessions('{"2026-11-08":{"open":"18:00","close":"19:00"}}'),
    ).toEqual({
      '2026-11-08': { open: '18:00', close: '19:00' },
    });
  });

  it('rejects malformed JSON and non-object values', () => {
    expect(() => readSpecialSessions('{')).toThrow();
    expect(() => readSpecialSessions('[]')).toThrow(
      'FOPLAYER_MARKET_SPECIAL_SESSIONS must be a JSON object.',
    );
  });

  it('rejects invalid date keys and invalid session values', () => {
    expect(() =>
      readSpecialSessions('{"not-a-date":{"open":"09:00","close":"10:00"}}'),
    ).toThrow(
      'Each special market session must use an ISO date and open/close times.',
    );
    expect(() => readSpecialSessions('{"2026-11-08":null}')).toThrow(
      'Each special market session must use an ISO date and open/close times.',
    );
    expect(() =>
      readSpecialSessions('{"2026-11-08":{"open":9,"close":"10:00"}}'),
    ).toThrow(
      'Each special market session must include string open and close times.',
    );
  });
});
