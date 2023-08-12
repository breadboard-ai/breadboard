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
import { Breadboard, BreadboardNode } from "./types.js";
import { IdVendor } from "./id.js";

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

const nodeIdVendor = new IdVendor();

const hasValues = (configuration: NodeConfiguration) => {
  return Object.values(configuration).filter(Boolean).length > 0;
};

export class Node<Inputs, Outputs> implements BreadboardNode<Inputs, Outputs> {
  #descriptor: NodeDescriptor;
  #breadboard: Breadboard;

  constructor(
    breadboard: Breadboard,
    type: NodeTypeIdentifier,
    configuration?: NodeConfiguration,
    id?: string
  ) {
    this.#breadboard = breadboard;
    this.#descriptor = {
      id: id ?? nodeIdVendor.vendId(breadboard, type),
      type,
    };

    if (configuration && hasValues(configuration))
      this.#descriptor.configuration = configuration;

    this.#breadboard.addNode(this.#descriptor);
  }

  wire<ToInputs, ToOutputs>(
    spec: string,
    to: BreadboardNode<ToInputs, ToOutputs>
  ): BreadboardNode<Inputs, Outputs> {
    const { ltr, edge } = parseSpec(spec);
    const toNode = to as Node<ToInputs, ToOutputs>;
    const result: Edge = {
      from: ltr ? this.#descriptor.id : toNode.#descriptor.id,
      to: ltr ? toNode.#descriptor.id : this.#descriptor.id,
      ...edge,
    };
    this.#breadboard.addEdge(result);
    return this;
  }
}
