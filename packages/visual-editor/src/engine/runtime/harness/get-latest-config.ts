/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  NodeConfiguration,
  NodeHandlerContext,
  NodeIdentifier,
  Outcome,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";

export { getLatestConfig };

function getLatestConfig(
  id: NodeIdentifier,
  graph: GraphDescriptor,
  context: NodeHandlerContext
): Outcome<NodeConfiguration> {
  const inspector = context.graphStore?.get()?.graphs.get("");
  if (!inspector) {
    return err(`Can't get inspector for graph "${graph.url}"`);
  }
  const inspectableNode = inspector.nodeById(id);
  if (!inspectableNode) {
    return err(`Unable to find node "${id}`);
  }
  return inspectableNode?.configuration();
}
