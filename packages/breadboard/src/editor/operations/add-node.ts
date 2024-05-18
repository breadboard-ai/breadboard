/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import {
  EdgeEditResult,
  EditOperation,
  EditSpec,
  EditableNodeSpec,
  SingleEditResult,
} from "../types.js";
import { InspectableGraphWithStore } from "../../inspector/types.js";

export class AddNode implements EditOperation {
  #graph: GraphDescriptor;
  #inspector: InspectableGraphWithStore;

  constructor(graph: GraphDescriptor, inspector: InspectableGraphWithStore) {
    this.#graph = graph;
    this.#inspector = inspector;
  }
  async can(spec: EditableNodeSpec): Promise<SingleEditResult> {
    const duplicate = !!this.#inspector.nodeById(spec.id);
    if (duplicate) {
      return {
        success: false,
        error: `Unable to add node: a node with id "${spec.id}" already exists`,
      };
    }

    const validType = !!this.#inspector.typeById(spec.type);
    if (!validType) {
      return {
        success: false,
        error: `Unable to add node: node type "${spec.type}" is not a known type`,
      };
    }

    return { success: true };
  }

  async do(spec: EditSpec): Promise<SingleEditResult> {
    if (spec.type !== "addnode") {
      throw new Error(
        `Editor API integrity error: expected type "addnode", received "${spec.type}" instead.`
      );
    }
    const node = spec.node;
    const can = await this.can(node);
    if (!can.success) {
      return can;
    }

    this.#graph.nodes.push(node);
    this.#inspector.nodeStore.add(node);
    return { success: true };
  }
}
