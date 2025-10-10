/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { createServerFetchWithCreds };

/**
 * A simplified version of fetchWithCreds that is used on the server. Here,
 * we don't check for scopes -- just get the access token when needed.
 * Note: There's a similar, but slightly different implementation of this
 * in packages/unified-server/src.
 * TODO: Combine the two
 */
function createServerFetchWithCreds(token: string) {
  return async (request: URL | Request | string, init?: RequestInit) => {
    const combinedRequest = new Request(request, init);
    // @ts-expect-error Something wonky with Headers bindings?
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
