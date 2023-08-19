/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Label } from "./label.js";

/**
 * Policies are for now just constraints on node types
 */

// TODO: Duplicating NodeTypeIdentifier from graph-runner here. In the future we
// might want to either introduce an abstraction to handle local namespaces or
// assume a global namespace that is valid across all graphs, even
// non-Breadboard ones like SQL queries.

type NodeTypeIdentifier = string;

export type Policy = Record<NodeTypeIdentifier, TrustedLabels>;

interface TrustedLabels {
  node?: Label;
  incoming?: Record<NodeTypeIdentifier, Label>;
  outgoing?: Record<NodeTypeIdentifier, Label>;
}
