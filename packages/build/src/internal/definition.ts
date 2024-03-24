/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeDescriberFunction,
  NodeHandlerFunction,
} from "@google-labs/breadboard";
import type { PortConfigMap, OutputPortReference, PortConfig } from "./port.js";
import type { ConvertBreadboardType } from "./type-system/type.js";
import type { CountUnion } from "./type-util.js";

export type ValueOrOutputPort<CONFIG extends PortConfig> =
  | ConvertBreadboardType<CONFIG["type"]>
  | OutputPortReference<CONFIG>;

/**
 * A more tightly constrained version of {@link NodeHandler}.
 *
 * TODO(aomarks) Give stronger types to invoke and describe, parameterized by
 * the node definition they belong to.
 */
export interface StrictNodeHandler {
  readonly invoke: NodeHandlerFunction;
  readonly describe: NodeDescriberFunction;
}

// To get errors in the right place, we're going to test if there are multiple
// primaries. If there are not, just return the type, everything is fine. If
// there are, return a version of the type which disallows primary. That way,
// the squiggly will appear on all the primaries.
export type ForbidMultiplePrimaries<M extends PortConfigMap> =
  HasMultiplePrimaries<M> extends true
    ? { [K in keyof M]: Omit<M[K], "primary"> & { primary: false } }
    : M;

export type HasMultiplePrimaries<M extends PortConfigMap> =
  CountUnion<PrimaryPortNames<M>> extends 0 | 1 ? false : true;

export type PrimaryPortNames<M extends PortConfigMap> = {
  [K in keyof M]: M[K]["primary"] extends true ? K : never;
}[keyof M];
