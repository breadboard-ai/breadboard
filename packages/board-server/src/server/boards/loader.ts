import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardServerStore } from "../types.js";

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
      const board = await store.loadBoard(user, fixBoardName(name));
      if (board) {
        res.locals.loadedBoard = board;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * Some board URLs use explicit suffixes to indicate the type of URL.
 * Substitute these so that the board lookup can succeed.
 *
 * TODO: #4778 - Stop doing this. Use different routes.
 */
function fixBoardName(boardName: string): string {
  return boardName
    .replace(/.api\//, ".json")
    .replace(/.app$/, ".json")
    .replace(/.invite$/, ".json");
}
