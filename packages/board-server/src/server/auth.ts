/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import type { AuthArgs, AuthResult, BoardServerStore } from "./types.js";
import { err, ok, type Outcome } from "@google-labs/breadboard";
import { unauthorized } from "./errors.js";

export { authenticate, authenticateAndGetUserStore };

type UserInfoPayload = {
  id: string;
};

function getConnectionArgs(req: IncomingMessage): Outcome<AuthArgs> {
  const url = new URL(req.url || "", "http://localhost");
  const key = url.searchParams.get("API_KEY");
  if (key) return { key };
  const auth = req.headers.authorization;
  if (!auth) {
    return err("Authorization header not found");
  }
  const [type, token] = auth.split(" ");
  if (type !== "Bearer" || !token) {
    return err("Invalid authorization header format");
  }
  return { token };
}

async function getUserId(token: string): Promise<Outcome<string>> {
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

async function authenticate(
  req: IncomingMessage,
  res: ServerResponse | null
): Promise<Outcome<AuthResult>> {
  const args = getConnectionArgs(req);
  if (!ok(args)) {
    if (res) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
    }
    return args;
  } else if ("key" in args) {
    return args;
  } else if ("token" in args) {
    const id = await getUserId(args.token);
    if (!ok(id)) {
      return id;
    }
    return { id };
  }
  return err("Unknown authentication format");
}

async function authenticateAndGetUserStore(
  req: IncomingMessage,
  res: ServerResponse | null,
  getStore: () => BoardServerStore
): Promise<Outcome<string>> {
  const userKey = await authenticate(req, res);
  if (!ok(userKey)) {
    return userKey;
  }
  let userPath;
  if ("key" in userKey) {
    const store = getStore();
    const userStore = await store.getUserStore(userKey.key);

    if (!userStore.success) {
      if (res) {
        unauthorized(res, userStore.error);
      }
      return err("Unauthorized");
    }
    userPath = userStore.store!;
  } else if ("id" in userKey) {
    userPath = userKey.id;
  }
  return userPath!;
}
