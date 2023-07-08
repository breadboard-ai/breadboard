/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../types.js";

/**
 * For now, we can only make a GET request with `Accept: application/json`
 * header. Let's start small.
 */
type FetchInputValues = {
  /**
   * The URL to fetch
   */
  url: string;
};

export default async (_cx: GraphTraversalContext, inputs: InputValues) => {
  const values = inputs as FetchInputValues;
  const data = await fetch(values.url, {
    headers: {
      Accept: "application/json",
    },
  });
  const response = await data.json();
  return { response };
};
