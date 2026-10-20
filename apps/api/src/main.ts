import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(Number.isInteger(port) && port > 0 ? port : 3000, '0.0.0.0');
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
