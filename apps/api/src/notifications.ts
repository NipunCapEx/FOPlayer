import type { AlertDispatcher, RiskAlert } from './monitoring.js';

export interface NotificationDeliveryStateStore {
  hasDeliveredTarget(
    idempotencyKey: string,
    targetKey: string,
  ): Promise<boolean>;
  markTargetDelivered(
    idempotencyKey: string,
    targetKey: string,
    deliveredAt: Date,
  ): Promise<void>;
}

export interface NotificationTransport {
  readonly deliveryKey?: string;
  send(alert: RiskAlert): Promise<void>;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramTransport implements NotificationTransport {
  readonly deliveryKey = 'telegram';

  constructor(
    private readonly config: TelegramConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(alert: RiskAlert): Promise<void> {
    if (!this.config.botToken || !this.config.chatId) {
      throw new Error('Telegram bot token and chat ID are required');
    }
    const response = await this.request(
      `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: alert.message,
          disable_web_page_preview: true,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Telegram delivery failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as { ok?: boolean };
    if (body.ok !== true) {
      throw new Error('Telegram API did not confirm delivery');
    }
  }
}

export class FcmDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'FcmDeliveryError';
  }
}

function isUnregisteredFcmToken(error: unknown): error is FcmDeliveryError {
  return error instanceof FcmDeliveryError && error.code === 'UNREGISTERED';
}

export interface FcmSender {
  sendMessage(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<void>;
}

export class FcmTransport implements NotificationTransport {
  readonly deliveryKey = 'fcm';
  private readonly deliveredTokensByAlert = new Map<string, Set<string>>();

  constructor(
    private readonly sender: FcmSender,
    private readonly getDeviceTokens: (strategyId: string) => Promise<string[]>,
    private readonly deliveryState?: NotificationDeliveryStateStore,
  ) {}

  async send(alert: RiskAlert): Promise<void> {
    const tokens = await this.getDeviceTokens(alert.strategyId);
    if (tokens.length === 0) {
      throw new Error('No registered FCM device token for strategy');
    }
    const delivered =
      this.deliveredTokensByAlert.get(alert.idempotencyKey) ??
      new Set<string>();
    const unsentTokens = await Promise.all(
      tokens.map(async (token) => ({
        token,
        delivered: this.deliveryState
          ? await this.deliveryState.hasDeliveredTarget(
              alert.idempotencyKey,
              `fcm:${token}`,
            )
          : delivered.has(token),
      })),
    ).then((items) =>
      items.filter((item) => !item.delivered).map((item) => item.token),
    );
    let retiredTokens = 0;
    const results = await Promise.allSettled(
      unsentTokens.map(async (token) => {
        try {
          await this.sender.sendMessage({
            token,
            title: `${alert.symbol}: ${alert.kind}`,
            body: alert.message,
            data: {
              alertId: alert.idempotencyKey,
              symbol: alert.symbol,
              kind: alert.kind,
            },
          });
          if (this.deliveryState) {
            await this.deliveryState.markTargetDelivered(
              alert.idempotencyKey,
              `fcm:${token}`,
              new Date(),
            );
          } else {
            delivered.add(token);
          }
          return 'delivered' as const;
        } catch (error) {
          if (this.deactivateDeviceToken && isUnregisteredFcmToken(error)) {
            await this.deactivateDeviceToken(token);
            retiredTokens += 1;
            return 'retired' as const;
          }
          throw error;
        }
      }),
    );
    if (results.some((result) => result.status === 'rejected')) {
      this.deliveredTokensByAlert.set(alert.idempotencyKey, delivered);
      throw new Error('FCM delivery failed for one or more registered devices');
    }
    const deliveredCount = results.filter(
      (result) => result.status === 'fulfilled' && result.value === 'delivered',
    ).length;
    if (retiredTokens > 0 && deliveredCount === 0) {
      throw new Error(
        'No deliverable FCM devices remain; unregistered tokens were deactivated',
      );
    }
    this.deliveredTokensByAlert.delete(alert.idempotencyKey);
  }
}

export class MultiChannelDispatcher implements AlertDispatcher {
  private readonly deliveredChannelsByAlert = new Map<string, Set<number>>();

  constructor(
    private readonly transports: NotificationTransport[],
    private readonly deliveryState?: NotificationDeliveryStateStore,
  ) {}

  async dispatch(alert: RiskAlert): Promise<void> {
    if (this.transports.length === 0) {
      throw new Error('No notification channels are configured');
    }
    const delivered =
      this.deliveredChannelsByAlert.get(alert.idempotencyKey) ??
      new Set<number>();
    const channelStates = await Promise.all(
      this.transports.map(async (transport, index) => {
        const targetKey = `channel:${transport.deliveryKey ?? index}`;
        return {
          transport,
          index,
          targetKey,
          delivered: this.deliveryState
            ? await this.deliveryState.hasDeliveredTarget(
                alert.idempotencyKey,
                targetKey,
              )
            : delivered.has(index),
        };
      }),
    );
    const unsent = channelStates.filter(
      ({ delivered: wasDelivered }) => !wasDelivered,
    );
    const results = await Promise.allSettled(
      unsent.map(async ({ transport, index, targetKey }) => {
        await transport.send(alert);
        if (this.deliveryState) {
          await this.deliveryState.markTargetDelivered(
            alert.idempotencyKey,
            targetKey,
            new Date(),
          );
        } else {
          delivered.add(index);
        }
      }),
    );
    if (results.some((result) => result.status === 'rejected')) {
      this.deliveredChannelsByAlert.set(alert.idempotencyKey, delivered);
      throw new Error('One or more notification channels failed');
    }
    this.deliveredChannelsByAlert.delete(alert.idempotencyKey);
  }
}

export interface FcmAccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export class FcmHttpSender implements FcmSender {
  constructor(
    private readonly projectId: string,
    private readonly accessTokens: FcmAccessTokenProvider,
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendMessage(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<void> {
    if (!this.projectId) throw new Error('Firebase project ID is required');
    const accessToken = await this.accessTokens.getAccessToken();
    if (!accessToken) throw new Error('Firebase access token is required');

    const response = await this.request(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: input.token,
            notification: { title: input.title, body: input.body },
            data: input.data,
          },
        }),
      },
    );
    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = (await response.json()) as {
          error?: {
            status?: unknown;
            details?: Array<{ errorCode?: unknown }>;
          };
        };
        const detailCode = body.error?.details?.find(
          (detail) => typeof detail.errorCode === 'string',
        )?.errorCode;
        if (typeof detailCode === 'string') code = detailCode;
        else if (typeof body.error?.status === 'string') {
          code = body.error.status;
        }
      } catch {
        // Keep HTTP status as the fallback when a provider body is not JSON.
      }
      throw new FcmDeliveryError(
        `FCM delivery failed with HTTP ${response.status}`,
        response.status,
        code,
      );
    }
  }
}
