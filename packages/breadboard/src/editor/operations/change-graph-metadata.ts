/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { EditOperation, EditSpec, SingleEditResult } from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";

export class ChangeGraphMetadata implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "changegraphmetadata") {
      throw new Error(
        `Editor API integrity error: expected type "changegraphmetadata", received "${spec.type}" instead.`
      );
    }
    const { metadata } = spec;
    this.#graph.metadata = metadata;
    return { success: true };
  }
}
