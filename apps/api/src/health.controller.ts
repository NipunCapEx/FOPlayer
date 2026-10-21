import { Controller, Get } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { marketHoursPolicyFromEnvironment } from './monitoring.js';

@Controller()
export class HealthController {
  constructor(private readonly firebase: FirebaseAdminService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'foplayer-api',
      firebaseConfigured: this.firebase?.isConfigured ?? false,
      marketHoursConfigurationValid:
        marketHoursPolicyFromEnvironment() !== null,
      marketDataAdapter: 'yahoo-finance-prototype',
      telegramConfigured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN &&
          process.env.TELEGRAM_CHAT_ID &&
          (process.env.FIREBASE_ALLOWED_UIDS ?? '')
            .split(',')
            .map((uid) => uid.trim())
            .filter(Boolean).length === 1,
      ),
      androidPushConfigured: this.firebase?.isConfigured ?? false,
    };
  }
}
