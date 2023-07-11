/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Edge,
  type NodeDescriptor,
  GraphTraversalContext,
  NodeHandlers,
  InputValues,
  OutputValues,
  GraphDescriptor,
  LogData,
  loadGraph,
  TraversalMachine,
} from "@google-labs/graph-runner";

import { IBreadboard, ILibrary } from "./types.js";
import { Starter } from "./starter.js";

export interface ContextProvider {
  getInputs(): InputValues;
  getHandlers(): NodeHandlers;
  getSlotted(): Record<string, GraphDescriptor>;
}

class BreadboardExecutionContext implements GraphTraversalContext {
  #breadboard: IBreadboard;
  #contextProvider: ContextProvider;
  #graph?: GraphDescriptor;
  #outputs: OutputValues = {};

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

  async provideExternalOutput(outputs: OutputValues): Promise<void> {
    this.#breadboard.dispatchEvent(
      new CustomEvent("output", {
        detail: outputs,
      })
    );
    this.#outputs = outputs;
  }

  async requestSlotOutput(
    slot: string,
    args: InputValues
  ): Promise<OutputValues> {
    const graph = this.#contextProvider.getSlotted()[slot];
    if (!graph) throw new Error(`No graph found for slot ${slot}`);
    const slottedBreadboard = Breadboard.fromGraphDescriptor(graph);
    let outputs: OutputValues = {};
    slottedBreadboard.addInputs(args);
    slottedBreadboard.on("output", (event) => {
      const { detail } = event as CustomEvent;
      outputs = detail;
    });
    await slottedBreadboard.run();
    return outputs;
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
  #slots: Record<string, GraphDescriptor> = {};

  async run() {
    const context = new BreadboardExecutionContext(this, {
      getInputs: () => this.#inputs,
      getHandlers: () =>
        this.#libraries.reduce((acc, lib) => {
          return { ...acc, ...lib.handlers };
        }, {}),
      getSlotted: () => this.#slots,
    });

    context.setCurrentGraph(this);
    const machine = new TraversalMachine(this);

    for await (const result of machine) {
      const { inputs, descriptor } = result;

      if (result.skip) continue;
      const handler = context.handlers[descriptor.type];
      if (!handler)
        throw new Error(`No handler for node type "${descriptor.type}"`);

      const outputs = (await handler(context, inputs)) || {};
      result.outputs = outputs;
    }
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

  slot(name: string, graph: GraphDescriptor): void {
    this.#slots[name] = graph;
  }

  static fromGraphDescriptor(graph: GraphDescriptor): Breadboard {
    const breadboard = new Breadboard();
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    // This registers a library. Maybe there's a more elegant way to do this?
    new Starter(breadboard);
    return breadboard;
  }

  static async load($ref: string): Promise<Breadboard> {
    const url = new URL($ref, new URL(import.meta.url));
    const path = url.protocol === "file:" ? $ref : undefined;
    const graph = await loadGraph(path, $ref);
    return Breadboard.fromGraphDescriptor(graph);
  }
}
