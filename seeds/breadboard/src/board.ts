/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeDescriptor,
  NodeHandlers,
  InputValues,
  GraphDescriptor,
  OutputValues,
} from "@google-labs/graph-runner";

import {
  type Breadboard,
  type BreadboardSlotSpec,
  type BreadbordRunResult,
  type Kit,
  type KitConstructor,
  type OptionalIdConfiguration,
  ProbeDetails,
} from "./types.js";

import { TraversalMachine, toMermaid } from "@google-labs/graph-runner";
import { Node } from "./node.js";
import { Core } from "./core.js";
import { InputStageResult, OutputStageResult } from "./run.js";
import { readFile } from "fs/promises";
import { KitLoader } from "./kit.js";

class ProbeEvent extends CustomEvent<ProbeDetails> {
  constructor(type: string, detail: ProbeDetails) {
    super(type, { detail });
  }
}

/**
 * @todo Make this just take a $ref and figure out when it's a path or a URL.
 * @param path
 * @param ref
 * @returns
 */
export const loadGraph = async (path?: string, ref?: string) => {
  if (path) return JSON.parse(await readFile(path, "utf-8"));
  if (!ref) throw new Error("To include, we need a path or a $ref");
  const response = await fetch(ref);
  return await response.json();
};

export class Board implements Breadboard {
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  kits: Kit[] = [];
  #slots: BreadboardSlotSpec = {};

  async *run(probe?: EventTarget): AsyncGenerator<BreadbordRunResult> {
    const core = new Core(this, this.#slots, probe);
    const kits = [core, ...this.kits];
    const handlers = kits.reduce((handlers, kit) => {
      return { ...handlers, ...kit.handlers };
    }, {} as NodeHandlers);

    const machine = new TraversalMachine(this);

    for await (const result of machine) {
      const { inputs, descriptor, missingInputs } = result;

      if (result.skip) {
        probe?.dispatchEvent(
          new ProbeEvent("skip", { descriptor, inputs, missingInputs })
        );
        continue;
      }

      if (descriptor.type === "input") {
        const inputStage = new InputStageResult(inputs);
        yield inputStage;
        result.outputs = inputStage.inputs;
        probe?.dispatchEvent(
          new ProbeEvent("input", {
            descriptor,
            inputs,
            outputs: result.outputs,
          })
        );
        continue;
      }

      if (descriptor.type === "output") {
        yield new OutputStageResult(inputs);
        probe?.dispatchEvent(new ProbeEvent("output", { descriptor, inputs }));
        continue;
      }

      const handler = handlers[descriptor.type];
      if (!handler)
        throw new Error(`No handler for node type "${descriptor.type}"`);

      const outputs = (await handler(inputs)) || {};
      probe?.dispatchEvent(
        new ProbeEvent("node", { descriptor, inputs, outputs })
      );

      result.outputs = outputs;
    }
  }

  async runOnce(
    inputs: InputValues,
    probe?: EventTarget
  ): Promise<OutputValues> {
    let outputs: OutputValues = {};
    for await (const result of this.run(probe)) {
      if (result.seeksInputs) {
        result.inputs = inputs;
      } else {
        outputs = result.outputs;
        // Exit once we receive the first output.
        break;
      }
    }
    return outputs;
  }

  /**
   * Core nodes. Breadboard won't function without these.
   * These are always included.
   */

  input(message?: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "input", { message, ...rest }, $id);
  }

  output(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "output", { ...rest }, $id);
  }

  include($ref: string, config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "include", { $ref, ...rest }, $id);
  }

  reflect(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "reflect", { ...rest }, $id);
  }

  slot(config: OptionalIdConfiguration = {}): Node {
    const { $id, ...rest } = config;
    return new Node(this, "slot", { ...rest }, $id);
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  addNode(node: NodeDescriptor): void {
    this.nodes.push(node);
  }

  addKit<T extends Kit>(ctr: KitConstructor<T>): T {
    const kit = new ctr((...args) => {
      return new Node(this, ...args);
    });
    this.kits.push(kit);
    return kit;
  }

  mermaid(): string {
    return toMermaid(this);
  }

  static async fromGraphDescriptor(graph: GraphDescriptor): Promise<Board> {
    const breadboard = new Board();
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    const loader = new KitLoader(graph.kits);
    (await loader.load()).forEach((kit) => breadboard.addKit(kit));
    return breadboard;
  }

  static async load($ref: string, slots?: BreadboardSlotSpec): Promise<Board> {
    const url = new URL($ref, new URL(import.meta.url));
    const path = url.protocol === "file:" ? $ref : undefined;
    const graph = await loadGraph(path, $ref);
    const board = await Board.fromGraphDescriptor(graph);
    board.#slots = slots || {};
    return board;
  }
}
