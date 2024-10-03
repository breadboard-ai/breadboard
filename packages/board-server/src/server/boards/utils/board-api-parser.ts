/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage } from "http";
import type { ParseResult } from "../../types.js";

const API_ENTRY = "/boards";

export const parseBoardURL = (url: URL, req: IncomingMessage): string => {
  const { pathname } = url;

  return url.pathname;
};

const notFound = (): ParseResult => ({
  success: false,
  error: "Not found",
  code: 404,
});

const invalidMethod = (): ParseResult => ({
  success: false,
  error: "Invalid method",
  code: 405,
});

export const parse = (url: URL, method: string = "GET"): ParseResult => {
  const parser = new BoardAPIParser(url, method);
  return parser.parse();
};

/**
 * Boards API routing logic:
 * GET /boards/ -> list boards
 * POST /boards/ -> create a new board
 * GET /boards/@:user/:name.json -> get a board
 * POST /boards/@:user/:name.json -> update/delete a board
 * GET /boards/@:user/:name.app -> serve frontend app for the board
 * GET /boards/@:user/:name.api -> serve API description for the board
 * POST /boards/@:user/:name.api/invoke -> BSE invoke entry point
 * POST /boards/@:user/:name.api/describe -> BSE describe entry point
 * POST /boards/@:user/:name.api/run -> Remote run entry point
 * GET /boards/@:user/:name.invite -> Get list of current invites for the board
 * POST /boards/@:user/:name.invite -> Create a new or delete existing invite
 */
export class BoardAPIParser {
  #url: URL;
  #method: string;

  constructor(url: URL, method: string) {
    this.#url = url;
    this.#method = method;
  }

  isBoardURL(): boolean {
    return this.#url.pathname.startsWith(API_ENTRY);
  }

  #getAdjustedBoardURL = (board: string): string => {
    const url = new URL(this.#url);
    url.pathname = `${API_ENTRY}/${board}`;
    url.search = "";
    return url.href;
  };

  parse(): ParseResult {
    if (!this.isBoardURL()) {
      return notFound();
    }
    const isGET = this.#method === "GET";
    const isPOST = this.#method === "POST";
    const isOPTIONS = this.#method === "OPTIONS";
    const { pathname } = this.#url;
    const parts = pathname.split("/").slice(2);
    if (parts.length === 0) {
      if (isOPTIONS) {
        return { success: true, type: "options" };
      }
      if (isGET) {
        return { success: true, type: "list" };
      } else if (isPOST) {
        return { success: true, type: "create" };
      }
      return invalidMethod();
    } else if (parts.length === 1) {
      return notFound();
    } else if (parts.length === 2 || parts.length === 3) {
      const [maybeUser, maybeName] = parts;
      const user = maybeUser?.startsWith("@") ? maybeUser.slice(1) : undefined;
      if (!user || !maybeName) {
        return notFound();
      }
      const isAPI = maybeName.endsWith(".api");
      const isApp = maybeName.endsWith(".app");
      const isJson = maybeName.endsWith(".json");
      const isInvite = maybeName.endsWith(".invite");

      if (isAPI) {
        const isInvoke = parts.length === 3 && parts[2] === "invoke";
        const isDescribe = parts.length === 3 && parts[2] === "describe";
        const isRun = parts.length === 3 && parts[2] === "run";
        const name = `${maybeName.slice(0, -".api".length)}.json`;
        const board = `@${user}/${name}`;
        const url = this.#getAdjustedBoardURL(board);
        if (isInvoke) {
          if (isOPTIONS) {
            return { success: true, type: "options" };
          }
          if (isPOST) {
            return { success: true, type: "invoke", board, url, user, name };
          } else {
            return invalidMethod();
          }
        }
        if (isDescribe) {
          if (isOPTIONS) {
            return { success: true, type: "options" };
          }
          if (isPOST) {
            return { success: true, type: "describe", board, url, user, name };
          } else {
            return invalidMethod();
          }
        }
        if (isRun) {
          if (isOPTIONS) {
            return { success: true, type: "options" };
          }
          if (isPOST) {
            return { success: true, type: "run", board, url, user, name };
          } else {
            return invalidMethod();
          }
        }
        return { success: true, type: "api", board, url, user, name };
      } else if (isApp && parts.length === 2) {
        const name = `${maybeName.slice(0, -".app".length)}.json`;
        const board = `@${user}/${name}`;
        const url = this.#getAdjustedBoardURL(board);
        return { success: true, type: "app", board, url, user, name };
      } else if (isJson && parts.length === 2) {
        const name = maybeName;
        const board = `@${user}/${name}`;
        const url = this.#getAdjustedBoardURL(board);
        if (isOPTIONS) {
          return { success: true, type: "options" };
        }
        if (this.#method === "GET") {
          return { success: true, type: "get", board, url, user, name };
        } else if (this.#method === "POST") {
          return { success: true, type: "update", board, url, user, name };
        }
      } else if (isInvite && parts.length === 2) {
        const name = `${maybeName.slice(0, -".invite".length)}.json`;
        const board = `@${user}/${name}`;
        const url = this.#getAdjustedBoardURL(board);
        if (isOPTIONS) {
          return { success: true, type: "options" };
        }
        if (this.#method === "GET") {
          return { success: true, type: "invite-list", board, url, user, name };
        } else if (this.#method === "POST") {
          return {
            success: true,
            type: "invite-update",
            board,
            url,
            user,
            name,
          };
        }
      }
    }
    return notFound();
  }
}
