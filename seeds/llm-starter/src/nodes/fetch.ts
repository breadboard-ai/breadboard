/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

export type FetchOutputs = {
  response: string | object;
};

export type FetchInputs = {
  /**
   * The URL to fetch
   */
  url: string;
  /*
   * The HTTP method to use
   */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /**
   * Headers to send with the request
   */
  headers?: Record<string, string>;
  /**
   * The body of the request
   */
  body?: string;
  /**
   * Whether or not to return raw text (as opposed to parsing JSON)
   */
  raw?: boolean;
};

export default async (inputs: InputValues) => {
  const {
    url,
    method = "GET",
    body,
    headers = {},
    raw,
  } = inputs as FetchInputs;
  if (!url) throw new Error("Fetch requires `url` input");
  const init = {
    method,
    headers,
    body: JSON.stringify(body),
  };
  const data = await fetch(url, init);
  const response = raw ? await data.text() : await data.json();
  return { response };
};
