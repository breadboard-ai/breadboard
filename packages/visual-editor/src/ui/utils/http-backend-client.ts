/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalBackendClient, OpalBackendRequestOptions } from "@breadboard-ai/types/opal-backend-client.js";
import { OPAL_BACKEND_API_PREFIX } from "@breadboard-ai/types";

export { HttpBackendClient };

/**
 * Default implementation of {@link OpalBackendClient} that sends authenticated
 * HTTP requests to the Opal backend via `fetchWithCreds`.
 */
class HttpBackendClient implements OpalBackendClient {
  readonly #fetchWithCreds: typeof fetch;

  constructor(fetchWithCreds: typeof fetch) {
    this.#fetchWithCreds = fetchWithCreds;
  }

  sendHttpRequest = async (
    methodName: string,
    options: OpalBackendRequestOptions
  ): Promise<Response> => {
    const { method, body, query, signal } = options;
    let url = `${OPAL_BACKEND_API_PREFIX}/v1beta1/${methodName}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }
    const init: RequestInit = { method, signal };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    return this.#fetchWithCreds(url, init);
  };
}
