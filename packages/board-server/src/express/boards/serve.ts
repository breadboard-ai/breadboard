import type { Request, Response, NextFunction } from 'express';
import { getStore } from '../../server/store.js';
import { serveIndex } from '../../server/common.js';
import { asyncHandler } from '../support.js';

const serve = async (req: Request, res: Response, next: NextFunction) => {
  const { user, boardName } = req.params;

  const store = getStore();

  const getMetadata = async () => {
    const board = await store.get(user!, boardName!);
    return board ? JSON.parse(board) : null;
  };

  await serveIndex(res.locals.serverConfig, res, getMetadata);
};

const boardServe = asyncHandler(serve);
export { boardServe as serve };