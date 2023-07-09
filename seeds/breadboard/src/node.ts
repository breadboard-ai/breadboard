/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeConfiguration,
  NodeDescriptor,
  NodeTypeIdentifier,
} from "@google-labs/graph-runner";
import { IBreadboard } from "./types.js";

export type PartialEdge = {
  out?: string;
  in?: string;
  optional?: boolean;
  constant?: boolean;
};

/**
 * Parses a given string according to the following grammar:
 * *|[{out}[->{in}][?|.]]
 * - if "*" is specified, this is all-value wiring. All available output values
 * will pass through this edge as input values.
 * - if "out" is not specified, this is an empty string, which means control-only
 * edge. No data passes through this edge.
 * - if "in" is not specified, "in" is assumed to be of the same value
 * as "out".
 * - if "?" is specified, this is an optional edge.
 * - if "." is specified, this is a constant edge.
 */
export const parseSpec = (spec: string): PartialEdge => {
  if (!spec) return {};
  if (spec === "*") return { out: "*" };
  const optional = spec.endsWith("?");
  const constant = spec.endsWith(".");
  if (constant || optional) spec = spec.slice(0, -1);
  const result: PartialEdge = {};
  if (constant) result.constant = true;
  if (optional) result.optional = true;
  const [outSpec, inSpec] = spec.split("->");
  if (!inSpec) return { out: outSpec, in: outSpec, ...result };
  return { out: outSpec, in: inSpec, ...result };
};

let nodeCount = 0;

const vendNodeId = (type: string) => {
  return `${type}-${++nodeCount}`;
};

export class Node implements NodeDescriptor {
  id: string;
  type: NodeTypeIdentifier;
  configuration?: NodeConfiguration;
  #breadboard: IBreadboard;

  constructor(
    breadboard: IBreadboard,
    type: NodeTypeIdentifier,
    configuration?: NodeConfiguration,
    id?: string
  ) {
    this.#breadboard = breadboard;
    this.id = id ?? vendNodeId(type);
    if (configuration) this.configuration = configuration;
    this.type = type;
    this.#breadboard.addNode(this);
  }

  wire(spec: string, to: Node): Node {
    const edge: Edge = {
      from: this.id,
      to: to.id,
      ...parseSpec(spec),
    };
    this.#breadboard.addEdge(edge);
    return this;
  }
}
