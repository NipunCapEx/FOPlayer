import { Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { HealthController } from './health.controller.js';
import {
  FirestoreMonitoringRepository,
  FirestoreStrategyStore,
} from './firestore-store.js';
import { YahooChartProvider, type MarketDataProvider } from './market-data.js';
import {
  FcmHttpSender,
  FcmTransport,
  MultiChannelDispatcher,
  TelegramTransport,
  type NotificationTransport,
} from './notifications.js';
import {
  PollingWorker,
  RiskMonitor,
  isIndianEquityMarketOpen,
  type AlertDispatcher,
  type MarketHoursPolicy,
  type MarketSession,
} from './monitoring.js';
import { MonitoringRunner } from './monitoring.runner.js';
import { StrategiesController } from './strategies.controller.js';
import { StrategyService } from './strategy.service.js';

export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');
export const ALERT_DISPATCHER = Symbol('ALERT_DISPATCHER');

@Module({
  controllers: [HealthController, StrategiesController],
  providers: [
    FirebaseAdminService,
    FirebaseAuthGuard,
    FirestoreMonitoringRepository,
    FirestoreStrategyStore,
    StrategyService,
    {
      provide: MARKET_DATA_PROVIDER,
      useFactory: (): MarketDataProvider => new YahooChartProvider(),
    },
    {
      provide: ALERT_DISPATCHER,
      useFactory: (
        firebase: FirebaseAdminService,
        strategyStore: FirestoreStrategyStore,
      ): AlertDispatcher => {
        const transports: NotificationTransport[] = [];
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const allowedUids = (process.env.FIREBASE_ALLOWED_UIDS ?? '')
          .split(',')
          .map((uid) => uid.trim())
          .filter(Boolean);
        if (botToken && chatId && allowedUids.length === 1) {
          transports.push(new TelegramTransport({ botToken, chatId }));
        }
        if (firebase.isConfigured) {
          transports.push(
            new FcmTransport(
              new FcmHttpSender(
                process.env.FIREBASE_PROJECT_ID ?? '',
                firebase,
              ),
              (strategyId) =>
                strategyStore.listDeviceTokensForStrategy(strategyId),
            ),
          );
        }
        return new MultiChannelDispatcher(transports);
      },
      inject: [FirebaseAdminService, FirestoreStrategyStore],
    },
    {
      provide: RiskMonitor,
      useFactory: (
        provider: MarketDataProvider,
        repository: FirestoreMonitoringRepository,
        dispatcher: AlertDispatcher,
      ) => new RiskMonitor(provider, repository, dispatcher),
      inject: [
        MARKET_DATA_PROVIDER,
        FirestoreMonitoringRepository,
        ALERT_DISPATCHER,
      ],
    },
    {
      provide: PollingWorker,
      useFactory: (monitor: RiskMonitor) => {
        const holidays = (process.env.FOPLAYER_MARKET_HOLIDAYS ?? '')
          .split(',')
          .map((date) => date.trim())
          .filter(Boolean);
        const specialSessions = readSpecialSessions(
          process.env.FOPLAYER_MARKET_SPECIAL_SESSIONS,
        );
        const policy: MarketHoursPolicy = {
          openingTime: process.env.FOPLAYER_MARKET_OPEN ?? '09:15',
          closingTime: process.env.FOPLAYER_MARKET_CLOSE ?? '15:30',
          holidays,
          specialSessions,
        };
        return new PollingWorker(monitor, {
          isMonitoringWindow: (now) => isIndianEquityMarketOpen(now, policy),
        });
      },
      inject: [RiskMonitor],
    },
    MonitoringRunner,
  ],
})
export class AppModule {}

function readSpecialSessions(
  raw: string | undefined,
): Record<string, MarketSession> {
  if (!raw?.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('FOPLAYER_MARKET_SPECIAL_SESSIONS must be a JSON object.');
  }
  const sessions: Record<string, MarketSession> = {};
  for (const [date, value] of Object.entries(parsed)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error(
        'Each special market session must use an ISO date and open/close times.',
      );
    }
    const session = value as Record<string, unknown>;
    if (typeof session.open !== 'string' || typeof session.close !== 'string') {
      throw new Error(
        'Each special market session must include string open and close times.',
      );
    }
    sessions[date] = { open: session.open, close: session.close };
  }
  return sessions;
}
