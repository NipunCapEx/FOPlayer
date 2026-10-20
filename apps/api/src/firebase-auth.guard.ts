import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAdminService } from './firebase-admin.service.js';

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  user?: { uid: string; email?: string };
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string') {
      throw new UnauthorizedException('Bearer token is required');
    }

    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match?.[1]) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const auth = this.firebase.auth;
    let decoded: DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(match[1]);
    } catch {
      throw new UnauthorizedException('Firebase ID token is invalid or expired');
    }

    const allowedUids = (process.env.FIREBASE_ALLOWED_UIDS ?? '')
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean);
    if (allowedUids.length > 0 && !allowedUids.includes(decoded.uid)) {
      throw new ForbiddenException('Firebase user is not allowlisted for FOPlayer');
    }

    request.user = {
      uid: decoded.uid,
      ...(decoded.email ? { email: decoded.email } : {}),
    };
    return true;
  }
}
