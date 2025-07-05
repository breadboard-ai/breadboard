/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";

export { condense };

// Given a GraphDescriptor, creates another GraphDescriptor that is a
// condensed graph representation of it.
// All strongly connected components of the graph are replaced with nodes
// whose types point at subgraphs, like this "#<id of subgraph>".
// The subgraph is created as follows:
// - a node of type "input" is created, and this node acts as a way to
//   capture all incoming edge ports (the "in" values), so that they
//   are correctly routed to inside of the subgraph
// - a node of type "output" is created, and this node acts as a way to
//   capture all outgoing edge ports (the "out" values), so that they
//   are correctly routed from the subgraph to.
// In effect, the input/output nodes in a subgraph act as a
// "function signature" of the subgraph.
// See https://en.wikipedia.org/wiki/Strongly_connected_component for
// discussion and definitions.
// IMPORTANT: All edges will have in/out port values. These serve as parameter
// names when a node (an asynchronous function) is executed.
function condense(graph: GraphDescriptor): GraphDescriptor {
  throw new Error("not implemented");
}
