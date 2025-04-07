import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardServerStore } from "../store.js";
import type { BoardId } from "../types.js";

export function parseBoardId(opts?: { addJsonSuffix?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    let { user = "", name = "" } = req.params;
    if (!!opts?.addJsonSuffix) {
      name += ".json";
    }
    let boardId: BoardId = {
      user,
      name,
    };
    res.locals.boardId = boardId;
    next();
  };
}

export function loadBoard(opts?: { addJsonSuffix?: boolean }): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let name = req.params.name;
      if (!name) {
        res.sendStatus(400);
        return;
      }
      if (opts?.addJsonSuffix) {
        name += ".json";
      }

      const store: BoardServerStore = res.app.locals.store;
      const board = await store.loadBoard({
        name,
        owner: req.params.user || res.locals.userId,
        requestingUserId: res.locals.userId,
      });
      if (board) {
        res.locals.loadedBoard = board;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
