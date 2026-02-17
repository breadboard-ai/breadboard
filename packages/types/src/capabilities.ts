/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata } from "./graph-descriptor.js";
import { NodeDescriberExport } from "./node-handler.js";
import { Schema } from "./schema.js";

export type DescribeOutputs = {
  title?: string;
  description?: string;
  metadata?: GraphMetadata;
  inputSchema: Schema;
  outputSchema: Schema;
  /**
   * A way for a describer to specify multiple entry points.
   * A common use case is a connector that offers multiple tools.
   * For a graph that contains exports, these will match the describer
   * results of the exports.
   */
  exports?: Record<string, NodeDescriberExport>;
};
