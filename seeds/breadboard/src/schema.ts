/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "./types.js";

export const empty = (additionalProperties = false) => ({
  type: "object",
  properties: {},
  additionalProperties,
});

export const fromInputs = (
  inputs: InputValues,
  additionalProperties = false
) => {
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(inputs).map(([key, value]) => [
        key,
        { type: typeof value },
      ])
    ),
    additionalProperties,
  };
};
