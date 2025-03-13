import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardId, BoardServerStore } from "../types.js";

export function parseBoardId(opts?: { addJsonSuffix?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    let { user = "", name = "" } = req.params;
    if (!!opts?.addJsonSuffix) {
      name += ".json";
    }
    let boardId: BoardId = {
      user,
      name,
      fullPath: `@${user}/${name}`,
    };
    res.locals.boardId = boardId;
    next();
  };
}

export function loadBoard(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { user = "", name = "" } = req.params;
      if (!user || !name) {
        res.sendStatus(400);
        return;
      }

      const store: BoardServerStore = res.app.locals.store;
      const board = await store.loadBoard(user, name);
      if (board) {
        res.locals.loadedBoard = board;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
