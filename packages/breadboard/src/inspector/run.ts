/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { GraphDescriptor, NodeDescriptor } from "../types.js";
import { EventManager } from "./event-manager.js";
import { replaceSecrets } from "./serializer.js";
import {
  GraphUUID,
  InspectableGraphStore,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunLoadResult,
  InspectableRunObserver,
  RunObserverOptions,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunLoadingOptions,
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

export class RunObserver implements InspectableRunObserver {
  #store: InspectableGraphStore;
  #options: RunObserverOptions;
  #runs: Run[] = [];

  constructor(store: InspectableGraphStore, options: RunObserverOptions) {
    this.#store = store;
    this.#options = options;
  }

  runs() {
    return this.#runs;
  }

  observe(result: HarnessRunResult): InspectableRun[] {
    if (result.type === "graphstart") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        // start a new run
        const run = new Run(
          timestamp,
          this.#store,
          result.data.graph,
          this.#options
        );
        this.#runs = [run, ...this.#runs];
      }
    } else if (result.type === "graphend") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        // close out the run
        const run = this.#runs[0];
        run.end = timestamp;
      }
    }
    const run = this.#runs[0];
    run.addResult(result);
    return this.#runs;
  }

  load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): InspectableRunLoadResult {
    const data = o as SerializedRun;
    if (data.$schema !== "tbd") {
      return {
        success: false,
        error: `Specified "$schema" is not valid`,
      };
    }
    try {
      const timeline = options?.secretReplacer
        ? replaceSecrets(data, options.secretReplacer).timeline
        : data.timeline;
      for (const result of timeline) {
        this.observe(result as HarnessRunResult);
      }
      return { success: true };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: `Loading run failed with the error ${error.message}`,
      };
    }
  }
}

export class Run implements InspectableRun {
  #events: EventManager;
  #highlightHelper = new NodeHighlightHelper();

  graphId: GraphUUID;
  start: number;
  end: number | null = null;
  graphVersion: number;
  messages: HarnessRunResult[] = [];

  constructor(
    timestamp: number,
    graphStore: InspectableGraphStore,
    graph: GraphDescriptor,
    options: RunObserverOptions
  ) {
    this.#events = new EventManager(graphStore, options);
    this.graphVersion = 0;
    this.start = timestamp;
    this.graphId = graphStore.add(graph, this.graphVersion);
  }

  get events(): InspectableRunEvent[] {
    return this.#events.events;
  }

  addResult(result: HarnessRunResult) {
    this.messages.push(result);
    this.#events.add(result);
    this.#highlightHelper.add(result);
  }

  serialize(options?: RunSerializationOptions): SerializedRun {
    return this.#events.serializer().serialize(options || {});
  }

  currentNode(position: number) {
    return this.#highlightHelper.currentNode(position);
  }
}
