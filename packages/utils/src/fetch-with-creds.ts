/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { ok } from "./outcome.js";

export { createFetchWithCreds };

export type TokenGetter = () => Promise<Outcome<string>>;

function createFetchWithCreds(tokenGetter: TokenGetter) {
  return async (request: URL | Request | string, init?: RequestInit) => {
    const combinedRequest = new Request(request, init);
    const token = await tokenGetter();
    if (!ok(token)) {
      throw new Error(`Unauthenticated: ${token.$error}`);
    }
    const oldHeaders = Object.fromEntries(combinedRequest.headers.entries());

    const requestWithCreds = new Request(combinedRequest, {
      headers: {
        ...oldHeaders,
        Authorization: `Bearer ${token}`,
      },
    });

    return fetch(requestWithCreds);
  };
}
