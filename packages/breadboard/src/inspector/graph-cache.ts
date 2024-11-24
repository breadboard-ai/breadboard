// /**
//  * @license
//  * Copyright 2024 Google LLC
//  * SPDX-License-Identifier: Apache-2.0
//  */

// import { GraphIdentifier } from "@breadboard-ai/types";
// import {
//   InspectableGraph,
//   InspectableGraphCache,
//   InspectableSubgraphs,
// } from "./types.js";

// export { GraphCache };

// class GraphCache implements InspectableGraphCache {
//   #graphs: Map<GraphIdentifier, InspectableGraph> = new Map();

//   add(id: GraphIdentifier, graph: InspectableGraph): void {
//     this.#graphs.set(id, graph);
//   }

//   graphs(): InspectableSubgraphs {
//     return Object.fromEntries(this.#graphs.entries());
//   }

//   remove(id: GraphIdentifier): void {
//     this.#graphs.delete(id);
//   }

//   clear(): void {
//     this.#graphs.clear();
//   }
// }
