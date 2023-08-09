/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SafetyLabel } from "./label.js";

// TODO: Add labels (and constraints) to edges

export interface Edge {
  from: Node;
  to: Node;
  fromConstraint?: SafetyLabel;
  toConstraint?: SafetyLabel;
}

export enum NodeRoles {
  placeHolder,
  passthrough,
}

export interface Node {
  node: { id: string };
  incoming: Edge[];
  outgoing: Edge[];
  label: SafetyLabel;
  constraint?: SafetyLabel;
  role?: NodeRoles;
}

export interface Graph {
  nodes: Node[];
}
