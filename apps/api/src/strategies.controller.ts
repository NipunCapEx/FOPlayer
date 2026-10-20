import {
  BadRequestException,
  Body,
  Controller,
  Get,
  UnauthorizedException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from './firebase-auth.guard.js';
import { StrategyService } from './strategy.service.js';

@Controller('api')
@UseGuards(FirebaseAuthGuard)
export class StrategiesController {
  constructor(private readonly strategies: StrategyService) {}

  @Get('dashboard')
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.strategies.dashboard(requireUid(request));
  }

  @Get('strategies')
  listStrategies(@Req() request: AuthenticatedRequest) {
    return this.strategies.list(requireUid(request));
  }

  @Post('strategies')
  createStrategy(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    if (!isRecord(body)) {
      throw new BadRequestException('request body must be an object');
    }
    return this.strategies.create(requireUid(request), {
      symbol: body.symbol,
      entryPrice: body.entryPrice,
    });
  }

  @Patch('strategies/:id')
  updateStrategy(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!isRecord(body)) {
      throw new BadRequestException('request body must be an object');
    }
    return this.strategies.update(requireUid(request), id, {
      ...(Object.hasOwn(body, 'entryPrice')
        ? { entryPrice: body.entryPrice }
        : {}),
      ...(Object.hasOwn(body, 'active') ? { active: body.active } : {}),
    });
  }

  @Get('alerts')
  listAlerts(@Req() request: AuthenticatedRequest) {
    return this.strategies.alerts(requireUid(request));
  }

  @Post('device-tokens')
  registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    if (!isRecord(body)) {
      throw new BadRequestException('request body must be an object');
    }
    return this.strategies.registerDevice(
      requireUid(request),
      body.strategyId,
      body.token,
    );
  }
}

function requireUid(request: AuthenticatedRequest): string {
  if (!request.user?.uid) {
    throw new UnauthorizedException('authenticated user context is missing');
  }
  return request.user.uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
