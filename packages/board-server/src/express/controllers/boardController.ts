import type { Request, Response, NextFunction } from 'express';
import list from './handlers/list.js';
import get from './handlers/get.js';
import create from './handlers/create.js';
import update from './handlers/update.js';
import serve from './handlers/serve.js';
import describe from './handlers/describe.js';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

export class BoardController { 
    constructor() {}

    list = asyncHandler(list);
    get = asyncHandler(get);
    create = asyncHandler(create);
    update = asyncHandler(update);
    serve = asyncHandler(serve);
    describe = asyncHandler(describe);
}