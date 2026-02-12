/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type {
  Capability,
  CommentNode,
  Edge,
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  GraphToRun,
  InputIdentifier,
  InputResponse,
  InputValues,
  KitDescriptor,
  KitReference,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputIdentifier,
  OutputResponse,
  OutputValues,
  RunArguments,
  SubGraphs,
} from "@breadboard-ai/types";
export type * from "@breadboard-ai/types/legacy.js";
export type * from "@breadboard-ai/types/node-handler.js";
export type * from "@breadboard-ai/types/schema.js";

import type {
  GraphToRun,
  InputValues,
  NodeDescriptor,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";

export type { NodeInvoker };

interface NodeInvoker {
  invokeNode(
    args: RunArguments,
    graph: GraphToRun,
    descriptor: NodeDescriptor,
    inputs: InputValues,
    invocationPath: number[]
  ): Promise<OutputValues>;
}
