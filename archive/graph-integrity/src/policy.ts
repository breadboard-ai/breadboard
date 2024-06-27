/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Label } from "./label.js";

/**
 * Policies are for now just constraints on node types
 */

// TODO: Duplicating NodeTypeIdentifier from `breadboard` here. In the future we
// might want to either introduce an abstraction to handle local namespaces or
// assume a global namespace that is valid across all graphs, even
// non-Breadboard ones like SQL queries.

type NodeTypeIdentifier = string;

export type Policy = Record<NodeTypeIdentifier, TrustedLabels>;

/**
 * Trusted label for a node type.
 *
 * @field node The label for the node itself. It gets applied to all outgoing
 *   edges (see below)
 * @field incoming The labels for incoming edges: Integrity is the integrity
 *   this node expects Confidentiality is what this node declassifies (!)
 * @field outgoing The labels for outgoing edges: Integrity is what this node
 *   endorses Confidentiality is what this node raises the outputs of
 */
interface TrustedLabels {
  node?: Label;
  incoming?: Record<NodeTypeIdentifier, Label>;
  outgoing?: Record<NodeTypeIdentifier, Label>;
}
