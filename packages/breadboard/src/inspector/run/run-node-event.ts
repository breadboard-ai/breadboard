/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EventIdentifier,
  HarnessRunResult,
  InputValues,
  InspectableGraph,
  InspectableNode,
  InspectableRun,
  InspectableRunNodeEvent,
  NodeDescriptor,
  NodeIdentifier,
  OutputValues,
  PathRegistryEntry,
  TraversalResult,
} from "@breadboard-ai/types";
import { BubbledInspectableNode } from "../graph/bubbled-node.js";
import { VirtualNode } from "../graph/virtual-node.js";
import { eventIdFromEntryId, idFromPath } from "./conversions.js";
import { NestedRun } from "./nested-run.js";

export class RunNodeEvent implements InspectableRunNodeEvent {
  type: "node";
  start: number;
  end: number | null;
  inputs: InputValues;
  outputs: OutputValues | null;
  result: HarnessRunResult | null;
  bubbled: boolean;
  hidden: boolean;

  /**
   * The id that will be used to create a `NodeDescriptor`.`
   */
  #id: NodeIdentifier;
  /**
   * The path registry entry associated with this event.
   */
  #entry: PathRegistryEntry;

  /**
   * A lazily-initialized InspectableNode instance.
   */
  #node: InspectableNode | null = null;

  /**
   * The TraversalResult associated with with this event
   */
  traversalResult?: TraversalResult;

  constructor(
    entry: PathRegistryEntry,
    node: NodeDescriptor,
    start: number,
    inputs: InputValues,
    traversalResult?: TraversalResult
  ) {
    if (!entry.parent) {
      throw new Error(
        `RunNodeEvent has no parent entry. This is a bug in Inspector API machinery. Node Id: ${node.id}`
      );
    }
    if (!entry.parent.graph) {
      throw new Error(
        `This node event's parent has no graph associated with it. Node Id: ${node.id}`
      );
    }

    if (entry.parent.graph.raw().virtual) {
      this.#node = new VirtualNode(node);
    }

    this.#entry = entry;
    this.type = "node";
    this.#id = node.id;
    this.start = start;
    this.end = null;
    this.inputs = inputs;
    this.outputs = null;
    this.result = null;
    this.bubbled = false;
    this.hidden = false;
    this.traversalResult = traversalResult;
  }

  get id(): EventIdentifier {
    return eventIdFromEntryId(idFromPath(this.#entry.path));
  }

  get graph(): InspectableGraph {
    return this.#entry.parent?.graph as InspectableGraph;
  }

  get node(): InspectableNode {
    if (this.#node) return this.#node;

    const node = this.graph.nodeById(this.#id);
    if (!node) {
      throw new Error(
        `RunNodeEvent could not find inspectable node. This is a bug in Inspector API machinery. Node Id: ${this.#id}`
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
