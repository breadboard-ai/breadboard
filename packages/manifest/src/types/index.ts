/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Allow additional properties.
 */
export type AdditionalProperties = {
  [x: string | number | symbol]: unknown;
};

export * from "./boards";
export * from "./guards";
export * from "./manifest";
export * from "./resource";

