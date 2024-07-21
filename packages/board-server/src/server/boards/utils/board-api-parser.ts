/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage } from "http";

const API_ENTRY = "/boards";

export const parseBoardURL = (url: URL, req: IncomingMessage): string => {
  const { pathname } = url;

  return url.pathname;
};

export type GeneralRequestType = "list" | "create";

export type UserRequestType =
  | "list"
  | "create"
  | "get"
  | "update"
  | "app"
  | "api"
  | "invoke"
  | "describe";

export type RequestType = GeneralRequestType | UserRequestType;

export type ParseResult =
  | {
      success: true;
      type: GeneralRequestType;
    }
  | {
      success: true;
      type: UserRequestType;
      board: string;
    }
  | { success: false; error: string; code: number };

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

  parse(): ParseResult {
    if (!this.isBoardURL()) {
      return notFound();
    }
    const isGET = this.#method === "GET";
    const isPOST = this.#method === "POST";
    const { pathname } = this.#url;
    const parts = pathname.split("/").slice(2);
    if (parts.length === 0) {
      if (isGET) {
        return { success: true, type: "list" };
      } else if (isPOST) {
        return { success: true, type: "create" };
      }
      return invalidMethod();
    } else if (parts.length === 1) {
      return notFound();
    } else if (parts.length === 2 || parts.length === 3) {
      const [maybeUser, name] = parts;
      const user = maybeUser?.startsWith("@") ? maybeUser.slice(1) : undefined;
      if (!user || !name) {
        return notFound();
      }
      const isAPI = name.endsWith(".api");
      const isApp = name.endsWith(".app");
      const isJson = name.endsWith(".json");

      if (isAPI) {
        const isInvoke = parts.length === 3 && parts[2] === "invoke";
        const isDescribe = parts.length === 3 && parts[2] === "describe";
        const board = `@${user}/${name.slice(0, -".api".length)}.json`;
        if (isInvoke) {
          if (isPOST) {
            return { success: true, type: "invoke", board };
          } else {
            return invalidMethod();
          }
        }
        if (isDescribe) {
          if (isPOST) {
            return { success: true, type: "describe", board };
          } else {
            return invalidMethod();
          }
        }
        return { success: true, type: "api", board };
      } else if (isApp && parts.length === 2) {
        const board = `@${user}/${name.slice(0, -".app".length)}.json`;
        return { success: true, type: "app", board };
      } else if (isJson && parts.length === 2) {
        const board = `@${user}/${name}`;
        if (this.#method === "GET") {
          return { success: true, type: "get", board };
        } else if (this.#method === "POST") {
          return { success: true, type: "update", board };
        }
      }
    }
    return notFound();
  }
}
