import { Controller, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

export abstract class BaseController {
    protected getTraceId(req: ExpressRequest): string {
        return (req as any).traceId || 'no-trace-id';
    }

    protected getActorRole(req: ExpressRequest): string {
        return (req as any).actorRole || 'developer';
    }
}
