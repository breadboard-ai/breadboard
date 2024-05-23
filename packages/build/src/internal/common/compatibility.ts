/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeDescriberFunction,
  NodeHandlerFunction,
} from "@google-labs/breadboard";

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
