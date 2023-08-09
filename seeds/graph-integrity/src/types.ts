/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Label } from "./label.js";

// TODO: Add labels (and constraints) to edges

export interface Edge {
  from: Node;
  to: Node;
  fromConstraint?: Label;
  toConstraint?: Label;
}

export enum NodeRoles {
  placeHolder,
  passthrough,
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
