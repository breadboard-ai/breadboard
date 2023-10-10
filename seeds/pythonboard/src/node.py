from breadboard_types import (
  Breadboard, BreadboardNode
)

from traversal.traversal_types import (
  Edge,
  NodeConfiguration,
  NodeDescriptor,
  NodeTypeIdentifier,
)
from typing import Optional

import { IdVendor } from "./id.js";

class PartialEdge():
  out: Optional[str] = None
  in: Optional[str] = None
  optional: Optional[bool] = None
  constant: Optional[bool] = None

class ParsedSpec():
  ltr: bool
  edge: Optional[PartialEdge] = None

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

class Node(BreadboardNode):
  _descriptor: NodeDescriptor;
  _breadboard: Breadboard;

  def __init__(
    self,
    breadboard: Breadboard,
    type: NodeTypeIdentifier,
    configuration?: NodeConfiguration,
    id?: str
  ) {
    self._breadboard = breadboard
    self._descriptor = {
      id: id ?? nodeIdVendor.vendId(breadboard, type),
      type,
    };

    if (configuration && hasValues(configuration))
      self._descriptor.configuration = configuration

    self._breadboard.addNode(self._descriptor)
  }

  def wire(
    spec: str,
    to: BreadboardNode,
  ) -> BreadboardNode:
    const { ltr, edge } = parseSpec(spec);
    const toNode = to as Node<ToInputs, ToOutputs>;
    if (self._breadboard !== toNode._breadboard) {
      raise Exception("Cannot wire nodes from different boards.")
    const result: Edge = {
      from: ltr ? this.#descriptor.id : toNode.#descriptor.id,
      to: ltr ? toNode.#descriptor.id : this.#descriptor.id,
      ...edge,
    }
    self._breadboard.addEdge(result)
    return self
