/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encodes a text string as a valid component of a Uniform Resource Identifier (URI).
 * @param uriComponent A value representing an unencoded URI component.
 */
declare function encodeURIComponent(
  uriComponent: string | number | boolean
): string;

declare module "@fetch" {
  export type FetchInputs = {
    /**
     * The URL to fetch
     */
    url: string;
    /**
     * The HTTP method to use. "GET is default.
     */
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /**
     * Headers to send with request
     */
    headers?: Record<string, string>;
    /**
     * The body of the request
     */
    body?: unknown;
  };

  export type FetchOutputs = {
    /**
     * The response from the fetch request
     */
    response: unknown;
    /**
     * The HTTP status code of the response
     */
    status: number;
    /**
     * The status text of the response
     */
    statusText: string;
    /**
     * The content type of the response
     */
    contentType: string;
    /**
     * The headers of the response
     */
    responseHeaders: Record<string, string>;
  };

  /**
   * A built-in capability of Breadboard to fetch data.
   */
  export default function fetch(url: FetchInputs): Promise<FetchOutputs>;
}

declare module "@secrets" {
  /**
   * A built-in capability of Breadboard to obtain secrets.
   */
  export default function secrets<S extends string>(inputs: {
    keys: S[];
  }): Promise<{ [K in S]: string }>;
}
