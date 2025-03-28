/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardServerStore } from "./store.js";
import { ok, type Outcome } from "@google-labs/breadboard";
import * as errors from "./errors.js";

/**
 * Extracts user credentials from the request.
 *
 * The server accepts both an API_KEY query parameter and an access token in an
 * authorization header. These values are added to Response.locals.apiKey or
 * Response.locals.accessToken if present.
 *
 * If either value is present, attempts to resolve the given credential to a
 * known user. If a user is found, sets Response.locals.userId.
 *
 * If accessToken or apiKey is set, but userId is not, that indicates that the
 * token or API key was not validated.
 *
 * Because not all endpoints require authentication, this middleware never
 * errors. Endpoints that require authentication should use `requireAuth` to
 * accept either mechanism, or `requireAccessToken` to specifically require a
 * validated access token.
 */
export function getUserCredentials(): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const key = req.query.API_KEY as string | undefined;
    if (key) {
      res.locals.apiKey = key;

      const store: BoardServerStore = req.app.locals.store;
      const userId = await store.findUserIdByApiKey(key);
      if (userId) {
        res.locals.userId = userId;
      }
    }

    const token = getAccessToken(req);
    if (token) {
      res.locals.accessToken = token;
      const id = await AccessTokenCache.instance.get(token);
      if (ok(id)) {
        res.locals.userId = id;
      }
    }

    next();
  };
}

function getAccessToken(req: Request): string {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return "";
  }

  const [type, token] = authorization.split(" ");
  if (type !== "Bearer" || !token) {
    return "";
  }

  return token;
}

/**
 * Middleware for a handler that requires an authorized user. Returns 401 if a
 * validated user was not found.
 */
export function requireAuth(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!res.locals.userId) {
      errors.unauthorized(res);
      return;
    }
    next();
  };
}

/**
 * Middleware for a handler that requires a valid access token. This is a
 * stronger check than requireAuth, because it does not allow API key
 * authentication.
 */
export function requireAccessToken(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!res.locals.userId || !res.locals.accessToken) {
      errors.unauthorized(res);
      return;
    }
    next();
  };
}

type UserInfoPayload = {
  id: string;
};

const TOKEN_LIFETIME_MS = 1 * 60 * 60 * 1000;

type AccessTokenCacheEntry = {
  id: string;
  expires: number;
};

class AccessTokenCache {
  #lastCleanup: number = Date.now();
  #map: Map<string, AccessTokenCacheEntry> = new Map();

  async getUserId(token: string): Promise<Outcome<string>> {
    try {
      const userInfo = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const result = (await userInfo.json()) as UserInfoPayload;
      return result.id;
    } catch (e) {
      return { $error: (e as Error).message };
    }
  }

  async get(token: string): Promise<Outcome<string>> {
    const entry = this.#map.get(token);
    if (!entry) {
      const id = await this.getUserId(token);
      if (!ok(id)) {
        return id;
      }
      const expires = Date.now() + TOKEN_LIFETIME_MS;
      this.#map.set(token, { id, expires });
      return id;
    }
    this.#cleanup();
    return entry.id;
  }

  async #cleanup() {
    if (Date.now() - this.#lastCleanup < TOKEN_LIFETIME_MS) {
      return;
    }
    const now = Date.now();
    this.#lastCleanup = now;
    return new Promise<void>((resolve) => {
      [...this.#map.entries()]
        .filter(([_, entry]) => entry.expires < now)
        .forEach(([token]) => {
          this.#map.delete(token);
        });
      resolve();
    });
  }

  static instance = new AccessTokenCache();
}
