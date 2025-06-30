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
  InputValues,
  OutputValues,
  Kit,
  Breadboard,
  BreadboardNode,
  NodeConfigurationConstructor,
} from "./types.js";
import { IdVendor } from "./id.js";

type PartialEdge = {
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

export const hasValues = (configuration: NodeConfigurationConstructor) => {
  return Object.values(configuration).length > 0;
};

export class Node<Inputs, Outputs> implements BreadboardNode<Inputs, Outputs> {
  #descriptor: NodeDescriptor;
  #breadboard: Breadboard;

  constructor(
    breadboard: Breadboard,
    kit: Kit | undefined,
    type: NodeTypeIdentifier,
    configuration?: NodeConfigurationConstructor,
    id?: string
  ) {
    this.#breadboard = breadboard.currentBoardToAddTo();
    this.#descriptor = {
      id: id ?? nodeIdVendor.vendId(this.#breadboard, type),
      type,
    };

    if (configuration && hasValues(configuration)) {
      // For convenience we allow passing nodes as configuration, which are
      // instead turned into constant incoming wires behind the scenes.
      const incomingWiresToAdd = Object.entries(configuration).filter(
        ([_, value]) => value instanceof Node
      ) as unknown as [string, Node<InputValues, OutputValues>][];
      for (const [wire, from] of incomingWiresToAdd) {
        delete configuration[wire];
        if (wire.indexOf("->") !== -1)
          throw Error("Cannot pass output wire in confdig");
        this.wire(wire.indexOf("<-") === -1 ? `${wire}<-.` : wire, from);
      }

      this.#descriptor.configuration = configuration as NodeConfiguration;
    }

    this.#breadboard.addNode(this.#descriptor);
  }

  wire<ToInputs, ToOutputs>(
    spec: string,
    to: BreadboardNode<ToInputs, ToOutputs>
  ): BreadboardNode<Inputs, Outputs> {
    const { ltr, edge } = parseSpec(spec);

    const [fromNode, toNode] = ltr
      ? [this, to as Node<ToInputs, ToOutputs>]
      : [to as Node<ToInputs, ToOutputs>, this];
    const result: Edge = {
      from: fromNode.#descriptor.id,
      to: toNode.#descriptor.id,
      ...edge,
    };

    if (fromNode.#breadboard !== toNode.#breadboard) {
      // Note edge on the target board, which is the only currently supported
      // version. Board.lambda() will use this to create a constant wire from
      // the input node to this node, and from fromNode to the lambda node in
      // the parent context, recursively if necessary.
      toNode.#breadboard.addEdgeAcrossBoards(
        result,
        fromNode.#breadboard,
        toNode.#breadboard
      );
    } else {
      this.#breadboard.addEdge(result);
    }
    return this;
  }

  get id() {
    return this.#descriptor.id;
  }
}
