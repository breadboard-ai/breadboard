/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

/**
 * For now, we can only make a GET request. Let's start small.
 */
type FetchInputValues = {
  /**
   * The URL to fetch
   */
  url: string;
  /**
   * Headers to send with the request
   */
  headers?: Record<string, string>;
  /**
   * Whether or not to return raw text (as opposed to parsing JSON)
   */
  raw?: boolean;
};

export default async (inputs: InputValues) => {
  const { url, headers, raw } = inputs as FetchInputValues;
  if (!url) throw new Error("Fetch requires `url` input");
  const init = headers ? { headers } : {};
  const data = await fetch(url, init);
  const response = raw ? await data.text() : await data.text();
  return { response };
};
