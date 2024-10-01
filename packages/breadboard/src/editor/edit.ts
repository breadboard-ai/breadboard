/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { InspectableGraph } from "../inspector/types.js";
import { EditSpec } from "./types.js";

/**
 * Represents an edit operation.
 */
export class Edit {
  #edits: EditSpec[];
  #graph: GraphDescriptor;
  #inspector: InspectableGraph;

  constructor(
    edits: EditSpec[],
    graph: GraphDescriptor,
    inspector: InspectableGraph
  ) {
    this.#edits = edits;
    this.#graph = graph;
    this.#inspector = inspector;
  }
}
