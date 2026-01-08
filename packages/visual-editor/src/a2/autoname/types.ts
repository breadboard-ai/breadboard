/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { JsonSerializable, LLMContent } from "@breadboard-ai/types";
import type { GeminiSchema } from "../a2/gemini.js";

export type NodeConfigurationUpdate = {
  configuration?: Record<string, JsonSerializable>;
  /**
   * Node type
   */
  type?: string;
};

export type Arguments = {
  nodeConfigurationUpdate?: NodeConfigurationUpdate;
};

export type AutonameMode = {
  canAutoname(): boolean;
  prompt(): LLMContent[];
  schema(): GeminiSchema;
};

/**
 * Represents an edge in a graph.
 */
export type Edge = {
  /**
   * The node that the edge is coming from.
   */
  from: string;

  /**
   * The node that the edge is going to.
   */
  to: string;

  /**
   * The input of the `to` node. If this value is undefined, then
   * the then no data is passed as output of the `from` node.
   */
  in?: string;

  /**
   * The output of the `from` node. If this value is "*", then all outputs
   * of the `from` node are passed to the `to` node. If this value is undefined,
   * then no data is passed to any inputs of the `to` node.
   */
  out?: string;

  /**
   * If true, this edge is optional: the data that passes through it is not
   * considered a required input to the node.
   */
  optional?: boolean;

  /**
   * If true, this edge acts as a constant: the data that passes through it
   * remains available even after the node has consumed it.
   */
  constant?: boolean;
};
