/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeIdentifier,
} from "@google-labs/breadboard-schema/graph.js";
import { EditOperation, EditSpec, SingleEditResult } from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";

export class ChangeConfiguration implements EditOperation {
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
        error: `Unable to update configuration: node with id "${id}" does not exist`,
      };
    }
    return { success: true };
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "changeconfiguration") {
      throw new Error(
        `Editor API integrity error: expected type "changeconfiguration", received "${spec.type}" instead.`
      );
    }
    const { id, configuration } = spec;
    const can = await this.can(id);
    if (!can.success) {
      return can;
    }
    const node = this.#inspector.nodeById(id);
    if (node) {
      node.descriptor.configuration = configuration;
    }
    return { success: true };
  }
}
