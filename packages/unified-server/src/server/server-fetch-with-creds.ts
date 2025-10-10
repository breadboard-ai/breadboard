/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyAuthClient } from "google-auth-library";

export { createServerFetchWithCreds };

/**
 * A simplified version of fetchWithCreds that is used on the server. Here,
 * we don't check for scopes -- just get the access token when needed.
 */
function createServerFetchWithCreds(authClient: AnyAuthClient) {
  return async (request: URL | Request | string, init?: RequestInit) => {
    const combinedRequest = new Request(request, init);
    const oldHeaders = Object.fromEntries(combinedRequest.headers.entries());

    const { token } = await authClient.getAccessToken();

    const requestWithCreds = new Request(combinedRequest, {
      headers: {
        ...oldHeaders,
        Authorization: `Bearer ${token}`,
      },
    });

    return fetch(requestWithCreds);
  };
}
