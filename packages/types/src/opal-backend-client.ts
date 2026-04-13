/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// IMPORTANT! All interfaces and types defined here must use the `declare`
// keyword to prevent them from being renamed by Closure Compilier
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export declare interface OpalBackendClient {
  /**
   * Sends an HTTP request to an Opal Backend RPC endpoint. Isolates the backend
   * origin and API version prefix (`/v1beta1/`) so that callers only need to
   * specify the RPC endpoint path (e.g., `"checkAppAccess"` or
   * `"sessions/new"`).
   *
   * The full URL is constructed as:
   *   `${BACKEND_API_ENDPOINT}/v1beta1/${rpcEndpoint}`
   *
   * When a `body` is provided, it is serialized with `JSON.stringify` and the
   * `Content-Type` header is set to `application/json` automatically.
   */
  sendHttpRequest(
    methodName: string,
    options: OpalBackendRequestOptions
  ): Promise<Response>;
}

export declare interface OpalBackendRequestOptions {
  /** HTTP method. */
  method: "GET" | "POST";

  /**
   * JSON-serializable request body. Serialized with `JSON.stringify`
   *  internally; callers should pass the object, not a string.
   */
  body?: unknown;

  /** Query parameters appended to the URL (e.g., `{ alt: "sse" }`). */
  query?: Record<string, string>;

  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
}
