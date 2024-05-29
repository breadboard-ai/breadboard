/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

export const getUserKey = (req: IncomingMessage) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }

  const [type, token] = auth.split(" ");
  if (type !== "Bearer") {
    return null;
  }
  return token;
};

export const authenticate = (
  req: IncomingMessage,
  res: ServerResponse
): string | null => {
  const userKey = getUserKey(req);
  if (!userKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return null;
  }
  return userKey;
};
