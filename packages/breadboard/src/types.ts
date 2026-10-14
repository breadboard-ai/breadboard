/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeIdentifier = string;

/**
 * Represents an edge (wire) connecting two nodes in the graph.
 */
export interface Edge {
  from: NodeIdentifier;
  to: NodeIdentifier;
  out?: string;
  in?: string;
  required?: boolean;
}

/**
 * Proxy interface for building node connections in a fluent API style.
 */
export interface NodeProxy {
  to(target: NodeIdentifier): void;
  requiredTo(target: NodeIdentifier): void;
}