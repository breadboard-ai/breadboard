/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

export { authenticate };

/**
 * For now, make a flag that controls whether to use simple requests or not.
 * Simple requests use "API_KEY" query parameter for authentication. *
 */
const USE_SIMPLE_REQUESTS = true;

export const getUserKey = (req: IncomingMessage) => {
  if (USE_SIMPLE_REQUESTS) {
    const url = new URL(req.url || "", "http://localhost");
    return url.searchParams.get("API_KEY");
  }

  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }

  const [type, token] = auth.split(" ");
  if (type !== "Bearer") {
    return null;
  }
  return token || null;
};

async function authenticate(
  req: IncomingMessage,
  res: ServerResponse
): Promise<string | null> {
  const userKey = getUserKey(req);
  if (!userKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return null;
  }
  return userKey;
}
