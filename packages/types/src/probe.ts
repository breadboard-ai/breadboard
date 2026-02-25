/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  NodeValue,
  OutputValues,
} from "./graph-descriptor.js";

/**
 * Sent by the runner just before a node is about to run.
 */
export type NodeStartResponse = {
  /**
   * The description of the node that is about to run.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  inputs: InputValues;
  /**
   * Unique identifier for this node invocation within the current run.
   */
  index: string;
  timestamp: number;
};

export type NodeEndResponse = {
  node: NodeDescriptor;
  inputs: InputValues;
  outputs: OutputValues;
  /**
   * Unique identifier for this node invocation within the current run.
   */
  index: string;
  timestamp: number;
  newOpportunities: Edge[];
};

export type GraphStartProbeData = {
  graph: GraphDescriptor;
  graphId: string;
  timestamp: number;
  edges?: { edge: Edge; value: NodeValue }[];
};

export type GraphStartProbeMessage = {
  type: "graphstart";
  data: GraphStartProbeData;
};

export type GraphEndProbeData = {
  timestamp: number;
};

export type GraphEndProbeMessage = {
  type: "graphend";
  data: GraphEndProbeData;
};

export type SkipProbeMessage = {
  type: "skip";
  data: {
    node: NodeDescriptor;
    inputs: InputValues;
    missingInputs: string[];
    timestamp: number;
  };
};

export type EdgeResponse = {
  edge: Edge;
  /**
   * The path of the outgoing node.
   */
  from?: number[];
  /**
   * The path of the incoming node.
   */
  to: number[];
  timestamp: number;
  value?: InputValues;
};

export type NodeStartProbeMessage = {
  type: "nodestart";
  data: NodeStartResponse;
};

export type NodeEndProbeMessage = {
  type: "nodeend";
  data: NodeEndResponse;
};

export type EdgeProbeMessage = {
  type: "edge";
  data: EdgeResponse;
};

export type ProbeMessage =
  | GraphStartProbeMessage
  | GraphEndProbeMessage
  | SkipProbeMessage
  | EdgeProbeMessage
  | NodeStartProbeMessage
  | NodeEndProbeMessage;

export interface Probe {
  report?(message: ProbeMessage): Promise<void>;
}
