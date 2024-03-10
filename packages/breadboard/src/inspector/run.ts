/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, HarnessRunner } from "../harness/types.js";
import { timestamp } from "../timestamp.js";
import { GraphDescriptor, NodeDescriptor } from "../types.js";
import { EventManager } from "./event.js";
import { GraphStore } from "./graph-store.js";
import {
  GraphUUID,
  InspectableGraphStore,
  InspectableRun,
  InspectableRunEvent,
} from "./types.js";

type GraphRecord = {
  nodes: NodeDescriptor[];
};

class NodeHighlightHelper {
  #history: (NodeDescriptor | undefined)[] = [];
  #graphStack: GraphRecord[] = [];
  #currentNode?: NodeDescriptor;

  #pushGraph() {
    this.#graphStack.push({ nodes: [] });
  }

  #popGraph() {
    this.#graphStack.pop();
  }

  #updateCurrentNode() {
    const graph = this.#graphStack[0];
    if (!graph) return;
    const descriptor = graph.nodes[graph.nodes.length - 1];
    if (!descriptor) return;
    this.#currentNode = descriptor;
  }

  #pushNode(descriptor: NodeDescriptor) {
    // For now, we only track current node at the top-level graph.
    // TODO: Support nested graphs.
    if (this.#graphStack.length > 1) return;

    const graph = this.#graphStack[0];
    if (!graph) return;

    graph.nodes.push(descriptor);
    this.#updateCurrentNode();
  }

  #popNode() {
    const graph = this.#graphStack[this.#graphStack.length - 1];
    if (!graph) return;

    graph.nodes.pop();
    this.#updateCurrentNode();
  }

  add(message: HarnessRunResult) {
    if (message.type === "graphstart") {
      this.#pushGraph();
    } else if (message.type === "graphend") {
      this.#popGraph();
    } else if (message.type === "nodestart") {
      this.#pushNode(message.data.node);
    } else if (message.type === "nodeend") {
      this.#popNode();
    }
    this.#history.push(this.#currentNode);
  }

  clear() {
    this.#graphStack.length = 0;
    this.#history.length = 0;
  }

  currentNode(position: number) {
    const entry = this.#history[position];
    if (!entry) {
      return "";
    }
    return entry.id;
  }
}

export const inspectableRun = (graph: GraphDescriptor): InspectableRun => {
  const store = new GraphStore();
  return new Run(store, graph);
};

export class Run implements InspectableRun {
  #events: EventManager;
  #highlightHelper = new NodeHighlightHelper();

  graphId: GraphUUID;
  start: number;
  end: number | null = null;
  graphVersion: number;
  messages: HarnessRunResult[] = [];

  constructor(graphStore: InspectableGraphStore, graph: GraphDescriptor) {
    this.#events = new EventManager(graphStore);
    this.graphVersion = 0;
    this.start = timestamp();
    this.graphId = graphStore.add(graph, this.graphVersion);
  }

  get events(): InspectableRunEvent[] {
    return this.#events.events;
  }

  observe(runner: HarnessRunner): HarnessRunner {
    return new Observer(runner, (event) => {
      this.messages.push(event);
      this.#events.add(event);
      this.#highlightHelper.add(event);
    });
  }

  currentNode(position: number) {
    return this.#highlightHelper.currentNode(position);
  }
}

type OnResult = (message: HarnessRunResult) => void;

class Observer implements HarnessRunner {
  #runner: HarnessRunner;
  #onResult: OnResult;

  constructor(runner: HarnessRunner, onResult: OnResult) {
    this.#onResult = onResult;
    this.#runner = runner;
  }

  async next() {
    const result = await this.#runner.next();
    if (result.done) {
      return result;
    }
    this.#onResult(result.value);
    return result;
  }
  async return() {
    return this.#runner.return();
  }
  async throw(error?: unknown) {
    return this.#runner.throw(error);
  }
  [Symbol.asyncIterator]() {
    return this;
  }
}
