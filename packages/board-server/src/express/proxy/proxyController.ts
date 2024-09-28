import type { Request, Response, NextFunction } from 'express';
import proxy from './handlers/proxy.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

export class ProxyController { 
    constructor() {}

    proxy = asyncHandler(proxy);
}