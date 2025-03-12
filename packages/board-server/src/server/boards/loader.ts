import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardServerStore } from "../types.js";
import { BoardNotFound } from "../store.js";

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

      res.locals.loadedBoard = await store.loadBoard(user, fixBoardName(name));
      next();
    } catch (e) {
      // TODO factor this into an error handler
      if (e instanceof BoardNotFound) {
        res.sendStatus(404);
      }
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
