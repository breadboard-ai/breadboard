/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

export class Node {
  wire(spec: string, to: Node): Node {
    return this;
  }
}
