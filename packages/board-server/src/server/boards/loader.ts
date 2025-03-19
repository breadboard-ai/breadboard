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
      let { user = "", name = "" } = req.params;
      if (!user || !name) {
        res.sendStatus(400);
        return;
      }
      if (!!opts?.addJsonSuffix) {
        name += ".json";
      }

      const store: BoardServerStore = res.app.locals.store;
      const currentUser = res.locals.userId ?? "";
      const board = await store.loadBoardByUser(user, name, currentUser);
      if (board) {
        res.locals.loadedBoard = board;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
