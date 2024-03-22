/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunResult } from "../harness/types.js";
import type { InputValues, NodeDescriptor, OutputValues } from "../types.js";
import type {
  EventIdentifier,
  InspectableNode,
  InspectableRun,
  InspectableRunNodeEvent,
  PathRegistryEntry,
} from "./types.js";
import { NestedRun } from "./nested-run.js";
import { BubbledInspectableNode } from "./bubbled-node.js";

export const eventIdFromEntryId = (entryId?: string): string => {
  return `e-${entryId || "0"}`;
};

export class RunNodeEvent implements InspectableRunNodeEvent {
  type: "node";
  node: NodeDescriptor;
  start: number;
  end: number | null;
  inputs: InputValues;
  outputs: OutputValues | null;
  result: HarnessRunResult | null;
  bubbled: boolean;
  hidden: boolean;

  /**
   * The path registry entry associated with this event.
   */
  #entry: PathRegistryEntry | null;

  constructor(
    entry: PathRegistryEntry | null,
    node: NodeDescriptor,
    start: number,
    inputs: InputValues
  ) {
    this.#entry = entry;
    this.type = "node";
    this.node = node;
    this.start = start;
    this.end = null;
    this.inputs = inputs;
    this.outputs = null;
    this.result = null;
    this.bubbled = false;
    this.hidden = false;
  }

  get id(): EventIdentifier {
    return eventIdFromEntryId(this.#entry?.id);
  }

  get inspectableNode(): InspectableNode | null {
    const node = this.#entry?.parent?.graph?.nodeById(this.node.id) || null;
    if (!node) {
      if (!this.#entry) {
        console.warn("This node event has no corresponding entry", this.node);
      } else if (!this.#entry.parent) {
        console.warn("This node event has no parent", this.node);
      } else if (!this.#entry.parent.graph) {
        console.warn(
          "This node event's parent has no graph associated with it",
          this.node
        );
      }
      return null;
    }
    if (this.bubbled) {
      return new BubbledInspectableNode(node);
    }
    return node;
  }

  get runs(): InspectableRun[] {
    if (!this.#entry || this.#entry.empty()) {
      return [];
    }
    const entry = this.#entry;
    const events = entry.events;
    // a bit of a hack: what I actually need is to find out whether this is
    // a map or not.
    // Maps have a peculiar structure: their children will have no events, but
    // their children's children (the parallel runs) will have events.
    if (events.length > 0) {
      // This is an ordinary run.
      return [new NestedRun(entry)];
    } else {
      // This is a map.
      return entry.children.filter(Boolean).map((childEntry) => {
        return new NestedRun(childEntry);
      });
    }
  }
}
