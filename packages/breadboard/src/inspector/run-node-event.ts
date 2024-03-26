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

export const entryIdFromEventId = (eventId?: string): string | null => {
  return eventId?.startsWith("e-") ? eventId.substring(2) : null;
};

export class RunNodeEvent implements InspectableRunNodeEvent {
  type: "node";
  descriptor: NodeDescriptor;
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
  #entry: PathRegistryEntry;

  /**
   * A lazily-initialized InspectableNode instance.
   */
  #node: InspectableNode | null = null;

  constructor(
    entry: PathRegistryEntry,
    descriptor: NodeDescriptor,
    start: number,
    inputs: InputValues
  ) {
    if (!entry.parent) {
      throw new Error(
        `RunNodeEvent has no parent entry. This is a bug in Inspector API machinery. Node Id: ${descriptor.id}`
      );
    }
    if (!entry.parent.graph) {
      throw new Error(
        `This node event's parent has no graph associated with it. Node Id: ${descriptor.id}`
      );
    }

    this.#entry = entry;
    this.type = "node";
    this.descriptor = descriptor;
    this.start = start;
    this.end = null;
    this.inputs = inputs;
    this.outputs = null;
    this.result = null;
    this.bubbled = false;
    this.hidden = false;
  }

  get id(): EventIdentifier {
    return eventIdFromEntryId(this.#entry.id);
  }

  get node(): InspectableNode {
    if (this.#node) return this.#node;

    const node = this.#entry.parent?.graph?.nodeById(this.descriptor.id);
    if (!node) {
      throw new Error(
        `RunNodeEvent could not find inspectable node. This is a bug in Inspector API machinery. Node Id: ${this.descriptor.id}`
      );
    }
    this.#node = this.bubbled ? new BubbledInspectableNode(node) : node;
    return this.#node;
  }

  get runs(): InspectableRun[] {
    if (this.#entry.empty()) {
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
