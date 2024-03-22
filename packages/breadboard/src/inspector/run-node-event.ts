/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunResult } from "../harness/types.js";
import type {
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  OutputValues,
} from "../types.js";
import type {
  EventIdentifier,
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectableRun,
  InspectableRunNodeEvent,
  PathRegistryEntry,
} from "./types.js";
import { NestedRun } from "./nested-run.js";
import { describeInput } from "./schemas.js";

export const eventIdFromEntryId = (entryId?: string): string => {
  return `e-${entryId || "0"}`;
};

class BubbledInspectableNode implements InspectableNode {
  descriptor: NodeDescriptor;
  #actual: InspectableNode;

  constructor(actual: InspectableNode) {
    const descriptor = actual.descriptor;
    if (descriptor.type !== "input" && descriptor.type !== "output") {
      throw new Error(
        "BubbledInspectableNode can only be an input or an output"
      );
    }
    this.#actual = actual;
    this.descriptor = descriptor;
  }

  title(): string {
    return this.#actual.title();
  }

  incoming(): InspectableEdge[] {
    return this.#actual.incoming();
  }

  outgoing(): InspectableEdge[] {
    return this.#actual.outgoing();
  }

  isEntry(): boolean {
    return this.#actual.isEntry();
  }

  isExit(): boolean {
    return this.#actual.isExit();
  }

  configuration(): NodeConfiguration {
    return this.#actual.configuration();
  }

  async describe(
    inputs?: InputValues | undefined
  ): Promise<NodeDescriberResult> {
    if (this.descriptor.type === "input") {
      return describeInput({ inputs });
    }
    return this.#actual.describe(inputs);
  }

  ports(inputs?: InputValues | undefined): Promise<InspectableNodePorts> {
    console.log("🍊 bubbled ports being examined", inputs);
    return this.#actual.ports(inputs);
  }
}

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
