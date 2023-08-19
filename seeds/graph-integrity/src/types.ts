/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Label } from "./label.js";

/**
 * Describing a graph as a list of nodes and edges.
 * This is the integrity-internal representation.
 */
export interface Edge {
  from: Node;
  to: Node;
  fromConstraint?: Label;
  toConstraint?: Label;
}

export enum NodeRoles {
  placeHolder = "placeHolder",
  passthrough = "passthrough",
}

export interface Node {
  node: { id: string };
  incoming: Edge[];
  outgoing: Edge[];
  label: Label;
  constraint?: Label;
  role?: NodeRoles;
}

export interface Graph {
  nodes: Node[];
}
