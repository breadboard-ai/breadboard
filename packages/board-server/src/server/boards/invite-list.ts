/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";
import { authenticateAndGetUserStore } from "../auth.js";
import { getStore } from "../store.js";
import type { BoardServerStore } from "../types.js";

async function inviteList(
  boardPath: string,
  req: Request,
  res: Response
): Promise<void> {
  let store: BoardServerStore | undefined = undefined;

  const userStore = await authenticateAndGetUserStore(req, res, () => {
    store = getStore();
    return store;
  });
  if (!ok(userStore)) {
    return;
  }

  if (!store) {
    store = getStore();
  }

  const result = await store.listInvites(userStore, boardPath);
  let responseBody;
  if (!result.success) {
    // TODO: Be nice and return a proper error code
    responseBody = { error: result.error };
  } else {
    responseBody = { invites: result.invites };
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(responseBody));
}

export default inviteList;
