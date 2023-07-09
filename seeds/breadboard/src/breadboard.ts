/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  traverseGraph,
  type Edge,
  type NodeDescriptor,
  GraphTraversalContext,
  NodeHandlers,
  InputValues,
  OutputValues,
  GraphDescriptor,
  LogData,
} from "@google-labs/graph-runner";

import { IBreadboard, ILibrary } from "./types.js";

export interface ContextProvider {
  getInputs(): InputValues;
  getHandlers(): NodeHandlers;
}

class BreadboardExecutionContext implements GraphTraversalContext {
  #breadboard: IBreadboard;
  #contextProvider: ContextProvider;
  #graph?: GraphDescriptor;

  constructor(breadboard: IBreadboard, contextProvider: ContextProvider) {
    this.#breadboard = breadboard;
    this.#contextProvider = contextProvider;
  }

  get handlers(): NodeHandlers {
    return this.#contextProvider.getHandlers();
  }

  async requestExternalInput(inputs: InputValues): Promise<OutputValues> {
    const { message } = inputs as { message: string };
    this.#breadboard.dispatchEvent(
      new CustomEvent("input", {
        detail: message,
      })
    );
    return this.#contextProvider.getInputs() as OutputValues;
  }

  async provideExternalOutput(inputs: InputValues): Promise<void> {
    this.#breadboard.dispatchEvent(
      new CustomEvent("output", {
        detail: inputs,
      })
    );
  }

  async requestSlotOutput(
    _slot: string,
    _inputs: InputValues
  ): Promise<OutputValues> {
    throw new Error("Method not implemented.");
  }

  async setCurrentGraph(graph: GraphDescriptor): Promise<void> {
    this.#graph = graph;
  }

  async getCurrentGraph(): Promise<GraphDescriptor> {
    return this.#graph as GraphDescriptor;
  }

  async log(data: LogData): Promise<void> {
    this.#breadboard.dispatchEvent(
      new CustomEvent("log", {
        detail: data,
      })
    );
  }
}

export class Breadboard extends EventTarget implements IBreadboard {
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  #libraries: ILibrary[] = [];
  #inputs: InputValues = {};

  async run() {
    const context = new BreadboardExecutionContext(this, {
      getInputs: () => this.#inputs,
      getHandlers: () =>
        this.#libraries.reduce((acc, lib) => {
          return { ...acc, ...lib.handlers };
        }, {}),
    });
    traverseGraph(context, this);
  }

  addInputs(inputs: InputValues): void {
    this.#inputs = { ...this.#inputs, ...inputs };
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  addNode(node: NodeDescriptor): void {
    this.nodes.push(node);
  }

  addLibrary(library: ILibrary): void {
    this.#libraries.push(library);
  }

  on(eventName: string, handler: EventListenerOrEventListenerObject) {
    this.addEventListener(eventName, handler);
  }
}
