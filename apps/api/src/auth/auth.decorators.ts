import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export type UserRole = 'client' | 'dropper' | 'admin';

export interface AuthedUser {
  id: string;
  email: string;
  role: UserRole;
  cognitoSub: string;
}

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';

/** Skip auth entirely (e.g. /health, /webhooks/stripe). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict route to one or more roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    if (!req.user) throw new UnauthorizedException('No authenticated user on request');
    return req.user;
  },
);
