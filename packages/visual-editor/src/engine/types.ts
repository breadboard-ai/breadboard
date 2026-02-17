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
  GraphDescriptor,
  InputValues,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlerContext,
  NodeIdentifier,
  OrchestrationPlan,
  Outcome,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";

export type { NodeInvoker };

interface NodeInvoker {
  invokeNode(
    args: RunArguments,
    descriptor: NodeDescriptor,
    inputs: InputValues
  ): Promise<OutputValues>;
}

export type { PlanCreator };

type PlanCreator = (graph: GraphDescriptor) => OrchestrationPlan;

export type { ConfigProvider };

type ConfigProvider = (
  id: NodeIdentifier,
  graph: GraphDescriptor,
  context: NodeHandlerContext
) => Outcome<NodeConfiguration>;

export type { RunEventSink };

interface RunEventSink {
  pause(): void;
  dispatch(event: Event): void;
}
