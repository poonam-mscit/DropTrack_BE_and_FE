import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import type { Database } from '@droptrack/db';
import { users } from '@droptrack/db';
import { DB } from '../db/db.module.js';
import { getCognitoVerifier, isCognitoEnabled } from './cognito.verifier.js';
import {
  type AuthedUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  type UserRole,
} from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const user = await this.resolveUser(req);
    req.user = user;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requires role: ${requiredRoles.join(' | ')} (you are ${user.role})`,
      );
    }
    return true;
  }

  /**
   * Three modes (order matters):
   *   1. Bearer token → verify against Cognito (production path).
   *   2. x-dev-user-id header → dev impersonation, allowed if NODE_ENV !== 'production'.
   *      This lets the login page's dev-shortcut buttons keep working even after
   *      Cognito is enabled, so we can iterate the UI without seeding real users.
   *   3. Cognito-only, no Bearer, no dev header → 401.
   */
  private async resolveUser(req: Request): Promise<AuthedUser> {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ') && isCognitoEnabled()) {
      return this.resolveCognitoUser(req);
    }
    const devId = req.headers['x-dev-user-id'];
    const devEmail = req.headers['x-dev-user-email'];
    if ((devId || devEmail) && process.env.NODE_ENV !== 'production') {
      return this.resolveDevUser(req);
    }
    if (isCognitoEnabled()) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    return this.resolveDevUser(req);
  }

  private async resolveCognitoUser(req: Request): Promise<AuthedUser> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = auth.slice('Bearer '.length);
    const verifier = getCognitoVerifier();
    if (!verifier) throw new UnauthorizedException('Cognito verifier unavailable');

    let payload: Awaited<ReturnType<typeof verifier.verify>>;
    try {
      payload = await verifier.verify(token);
    } catch (err) {
      this.logger.warn(`JWT verify failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid token');
    }

    const sub = payload.sub as string;
    const [row] = await this.db.select().from(users).where(eq(users.cognitoSub, sub)).limit(1);
    if (!row) throw new UnauthorizedException('User not provisioned in DropTrack');
    if (row.status !== 'active') throw new ForbiddenException(`Account ${row.status}`);
    return { id: row.id, email: row.email, role: row.role, cognitoSub: row.cognitoSub };
  }

  private async resolveDevUser(req: Request): Promise<AuthedUser> {
    // DEV ONLY: pick a user by id (or email) via header.
    const devId = req.headers['x-dev-user-id'];
    const devEmail = req.headers['x-dev-user-email'];
    if (!devId && !devEmail) {
      throw new UnauthorizedException(
        'Dev mode: pass x-dev-user-id or x-dev-user-email header (Cognito not configured)',
      );
    }
    const where = devId
      ? eq(users.id, String(devId))
      : eq(users.email, String(devEmail));
    const [row] = await this.db.select().from(users).where(where).limit(1);
    if (!row) throw new UnauthorizedException('Dev user not found');
    if (row.status !== 'active') throw new ForbiddenException(`Account ${row.status}`);
    this.logger.warn(`DEV AUTH: impersonating ${row.email} (${row.role})`);
    return { id: row.id, email: row.email, role: row.role, cognitoSub: row.cognitoSub };
  }
}
