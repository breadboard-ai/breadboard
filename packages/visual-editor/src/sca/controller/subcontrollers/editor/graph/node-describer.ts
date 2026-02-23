/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeConfiguration,
  NodeDescriberResult,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";

export { type NodeDescriber };

/**
 * A function that resolves a node type's input/output schemas.
 *
 * Injected into GraphController at initialization time, keeping the
 * Controller free of runtime/handler imports (proper SCA Service boundary).
 *
 * Built from `getHandler()` + `handler.describe()` at the call site.
 */
type NodeDescriber = (
  type: NodeTypeIdentifier,
  configuration: NodeConfiguration
) => Promise<NodeDescriberResult>;
