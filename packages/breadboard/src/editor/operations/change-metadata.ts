/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeIdentifier,
  NodeMetadata,
} from "@google-labs/breadboard-schema/graph.js";
import { EditOperation, EditSpec, SingleEditResult } from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";

export class ChangeMetadata implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }

  async can(id: NodeIdentifier): Promise<SingleEditResult> {
    const node = this.#inspector.nodeById(id);
    if (!node) {
      return {
        success: false,
        error: `Node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  #isVisualOnly(incoming: NodeMetadata, existing: NodeMetadata): boolean {
    return (
      existing.title === incoming.title &&
      existing.description === incoming.description &&
      existing.logLevel === incoming.logLevel
    );
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "changemetadata") {
      throw new Error(
        `Editor API integrity error: expected type "changemetadata", received "${spec.type}" instead.`
      );
    }
    const { id, metadata } = spec;
    if (!metadata) {
      return {
        success: false,
        error: "Metadata wasn't supplied.",
      };
    }
    const can = await this.can(id);
    if (!can.success) return can;
    const node = this.#inspector.nodeById(id);
    if (!node) {
      const error = `Unknown node with id "${id}"`;
      return { success: false, error };
    }
    const visualOnly = this.#isVisualOnly(
      metadata,
      node.descriptor.metadata || {}
    );
    node.descriptor.metadata = metadata;
    return { success: true, visualOnly };
  }
}
