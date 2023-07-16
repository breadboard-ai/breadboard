/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeConfiguration,
  NodeTypeIdentifier,
} from "@google-labs/graph-runner";
import { Breadboard, BreadboardNode } from "./types.js";

export type PartialEdge = {
  out?: string;
  in?: string;
  optional?: boolean;
  constant?: boolean;
};

type ParsedSpec = {
  ltr: boolean;
  edge?: PartialEdge;
};

const specRegex = /^((?<a>.*)(?<dir><-|->))?(?<b>[^(.|?)]*)(?<q>\.|\?)?$/m;

type RegexGroups = {
  a?: string;
  b?: string;
  dir?: string;
  q?: string;
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
export const parseSpec = (spec: string): ParsedSpec => {
  const result: ParsedSpec = { ltr: true };
  const match = spec.match(specRegex);
  if (!match) throw new Error(`Invalid edge spec: ${spec}`);
  const { a, b, dir, q } = match?.groups as RegexGroups;
  const ltr = dir !== "<-";
  result.ltr = ltr;
  const optional = q === "?";
  const constant = q === ".";
  result.edge = {};
  if (constant) result.edge.constant = true;
  if (optional) result.edge.optional = true;
  if (!a && !b) return result;
  if (a === "*" || b === "*") {
    result.edge.out = "*";
    return result;
  }
  if (!a) {
    result.edge.out = b;
    result.edge.in = b;
    return result;
  }
  if (!b) {
    result.edge.out = a;
    result.edge.in = a;
    return result;
  }
  if (ltr) {
    result.edge.out = a;
    result.edge.in = b;
  } else {
    result.edge.out = b;
    result.edge.in = a;
  }
  return result;
};

// Count nodes scoped to their breadboard.
const nodeCounts = new Map<object, number>();

const vendNodeId = (breadboard: Breadboard, type: string) => {
  let nodeCount = nodeCounts.get(breadboard) || 0;
  nodeCount++;
  nodeCounts.set(breadboard, nodeCount);
  return `${type}-${nodeCount}`;
};

const hasValues = (configuration: NodeConfiguration) => {
  return Object.values(configuration).filter(Boolean).length > 0;
};

export class Node implements BreadboardNode {
  id: string;
  type: NodeTypeIdentifier;
  configuration?: NodeConfiguration;
  #breadboard: Breadboard;

  constructor(
    breadboard: Breadboard,
    type: NodeTypeIdentifier,
    configuration?: NodeConfiguration,
    id?: string
  ) {
    this.#breadboard = breadboard;
    this.id = id ?? vendNodeId(breadboard, type);

    if (configuration && hasValues(configuration))
      this.configuration = configuration;

    this.type = type;
    this.#breadboard.addNode(this);
  }

  wire(spec: string, to: BreadboardNode): BreadboardNode {
    const { ltr, edge } = parseSpec(spec);
    const result: Edge = {
      from: ltr ? this.id : to.id,
      to: ltr ? to.id : this.id,
      ...edge,
    };
    this.#breadboard.addEdge(result);
    return this;
  }
}
