import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { ROLES, type Role } from './governance.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const headerRole = String(req.headers['x-role'] ?? 'developer').trim().toLowerCase();
    const actorRole = (ROLES as readonly string[]).includes(headerRole) ? (headerRole as Role) : 'developer';
    req.actorRole = actorRole;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (requiredRoles.includes(actorRole)) {
      return true;
    }

    throw new ForbiddenException(`Role '${actorRole}' is not allowed for this endpoint`);
  }
}
