import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../src/firebase-auth.guard.js';
import type { FirebaseAdminService } from '../src/firebase-admin.service.js';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  it('verifies a bearer token and attaches only the verified identity', async () => {
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const verifyIdToken = vi.fn(async () => ({
      uid: 'user-1',
      email: 'user@example.test',
    }));
    const firebase = {
      auth: { verifyIdToken },
    } as unknown as FirebaseAdminService;
    const guard = new FirebaseAuthGuard(firebase);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
    expect(request.user).toEqual({
      uid: 'user-1',
      email: 'user@example.test',
    });
  });

  it('rejects missing and malformed bearer tokens', async () => {
    const firebase = {
      auth: { verifyIdToken: vi.fn() },
    } as unknown as FirebaseAdminService;
    const guard = new FirebaseAuthGuard(firebase);

    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Basic token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(
      (firebase.auth as unknown as { verifyIdToken: ReturnType<typeof vi.fn> })
        .verifyIdToken,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired Firebase tokens', async () => {
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer expired-token' },
    };
    const firebase = {
      auth: {
        verifyIdToken: vi.fn(async () => {
          throw new Error('token expired');
        }),
      },
    } as unknown as FirebaseAdminService;
    const guard = new FirebaseAuthGuard(firebase);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      'Firebase ID token is invalid or expired',
    );
  });

  it('rejects revoked Firebase ID tokens by requesting revocation checking', async () => {
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer revoked-token' },
    };
    const verifyIdToken = vi.fn(async (_token: string, checkRevoked?: boolean) => {
      expect(checkRevoked).toBe(true);
      throw new Error('auth/id-token-revoked');
    });
    const guard = new FirebaseAuthGuard({
      auth: { verifyIdToken },
    } as unknown as FirebaseAdminService);

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      'Firebase ID token is invalid or expired',
    );
    expect(verifyIdToken).toHaveBeenCalledWith('revoked-token', true);
    expect(request.user).toBeUndefined();
  });

  it('enforces the configured UID allowlist and omits absent email claims', async () => {
    const original = process.env.FIREBASE_ALLOWED_UIDS;
    process.env.FIREBASE_ALLOWED_UIDS = 'allowed-user';
    try {
      const verifyIdToken = vi.fn(async () => ({ uid: 'blocked-user' }));
      const guard = new FirebaseAuthGuard({
        auth: { verifyIdToken },
      } as unknown as FirebaseAdminService);
      await expect(
        guard.canActivate(
          contextFor({ headers: { authorization: 'Bearer token' } }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const allowedRequest: AuthenticatedRequest = {
        headers: { authorization: 'Bearer allowed-token' },
      };
      const allowedGuard = new FirebaseAuthGuard({
        auth: { verifyIdToken: vi.fn(async () => ({ uid: 'allowed-user' })) },
      } as unknown as FirebaseAdminService);
      await expect(
        allowedGuard.canActivate(contextFor(allowedRequest)),
      ).resolves.toBe(true);
      expect(allowedRequest.user).toEqual({ uid: 'allowed-user' });
    } finally {
      if (original === undefined) delete process.env.FIREBASE_ALLOWED_UIDS;
      else process.env.FIREBASE_ALLOWED_UIDS = original;
    }
  });

  it('returns service unavailable rather than allowing requests when Firebase is not configured', async () => {
    const firebase = {
      get auth(): never {
        throw new ServiceUnavailableException('Firebase not configured');
      },
    } as unknown as FirebaseAdminService;
    const guard = new FirebaseAuthGuard(firebase);

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer valid-token' } }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
