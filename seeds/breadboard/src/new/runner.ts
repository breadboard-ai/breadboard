/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphMetadata,
  NodeDescriptor,
  Edge,
  Kit,
  InputValues as OriginalInputValues,
  OutputValues as OriginalOutputValues,
  BreadboardRunner,
  BreadboardRunResult,
  NodeHandlerContext,
  BreadboardValidator,
  BoardRunner as OriginalBoardRunner,
} from "@google-labs/breadboard";
import {
  InputValues,
  OutputValues,
  InputsMaybeAsValues,
  EdgeInterface,
  InvokeCallbacks,
  AbstractNode,
} from "./types.js";

import { getCurrentContextScope } from "./default-scope.js";
import { handlersFromKit } from "./kits.js";
import { BaseNode } from "./node.js";
import { Scope } from "./scope.js";

function createProbeCallbacks(probe: EventTarget): InvokeCallbacks {
  const lastNodeDetails = new Map<string, object>();
  let lastNode: object | undefined = undefined;

  return {
    before: async (node, inputs) => {
      const detail = {
        descriptor: {
          id: node.id,
          type: node.type,
          configuration: node.configuration,
        } as NodeDescriptor,
        inputs,
        outputs: Promise.resolve({}),
      };
      const shouldInvokeHandler = probe.dispatchEvent(
        new CustomEvent("beforehandler", {
          detail,
          cancelable: true,
        })
      );
      return shouldInvokeHandler ? undefined : detail.outputs;
    },
    after: (node, inputs, outputs, distribution) => {
      const detail = {
        descriptor: {
          id: node.id,
          type: node.type,
          configuration: node.configuration,
        } as NodeDescriptor,
        inputs,
        outputs,
        receivingNodes: Object.fromEntries(
          distribution.nodes
            .filter((node) => node.received.length > 0)
            .map((node) => [node.node.id, node.received])
        ),
        incompleteNodes: Object.fromEntries(
          distribution.nodes
            .filter((node) => node.missing !== false)
            .map((node) => [node.node.id, node.missing])
        ),
        unusedKeys: distribution.unused,
      };
      probe.dispatchEvent(new CustomEvent("node", { detail }));

      // Keep track of the last run of any node with incomplete next nodes
      if (Object.entries(detail.incompleteNodes).length > 0)
        lastNodeDetails.set(node.id, detail);
      else lastNodeDetails.delete(node.id);

      lastNode = detail;
    },
    done: () => {
      // For convenience, send a done event with the last node's details. In a
      // developer tool, this could be highlighted if the last node wasn't
      // expected, e.g. not an output node, and it might point out where the graph
      // got stuck.
      probe.dispatchEvent(
        new CustomEvent("done", {
          detail: {
            last: lastNode,
            incompleteNextNodes: [...lastNodeDetails.values()],
          },
        })
      );
    },
  };
}
/**
 * Implements the current API, so that we can run in existing Breadboard
 * environments.
 */

export class Runner implements BreadboardRunner {
  kits: Kit[] = []; // No-op for now
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  args?: OriginalInputValues;

  #scope: Scope;
  #anyNode?: AbstractNode;

  constructor() {
    // Initial Scope is from call context of where the board is created
    this.#scope = new Scope({ declaringScope: getCurrentContextScope() });
  }

  async *run({
    probe,
    kits,
  }: NodeHandlerContext): AsyncGenerator<BreadboardRunResult> {
    if (!this.#anyNode)
      throw new Error("Can't run board without any nodes in it");

    const scope = new Scope({
      declaringScope: this.#scope,
      invokingScope: getCurrentContextScope(),
    });

    let streamController: ReadableStreamDefaultController<BreadboardRunResult>;
    const stream = new ReadableStream<BreadboardRunResult>({
      start(controller) {
        streamController = controller;
      },
    });

    scope.addHandlers({
      input: async (inputs: InputsMaybeAsValues<InputValues>, node) => {
        let resolver: (outputs: OutputValues) => void;
        const outputsPromise = new Promise<OutputValues>((resolve) => {
          resolver = resolve;
        });
        const descriptor = { type: node.type, id: node.id };
        const result = {
          type: "input",
          node: descriptor,
          inputArguments: inputs as OriginalInputValues,
          set inputs(inputs: OriginalInputValues) {
            resolver(inputs as OutputValues);
          },
          state: { skip: false } as unknown as BreadboardRunResult["state"],
        } as BreadboardRunResult;
        streamController.enqueue(result);
        outputsPromise.then((result) =>
          probe?.dispatchEvent(
            new CustomEvent("input", {
              detail: { descriptor, inputs, outputs: result },
            })
          )
        );
        return outputsPromise as Promise<OutputValues>;
      },
      output: async (inputs: InputsMaybeAsValues<InputValues>, node) => {
        const descriptor = { type: node.type, id: node.id };
        const result = {
          type: "output",
          node: descriptor,
          outputs: inputs as OriginalInputValues,
          state: { skip: false } as unknown as BreadboardRunResult["state"],
        } as BreadboardRunResult;
        probe?.dispatchEvent(
          new CustomEvent("output", {
            detail: { descriptor, inputs },
            cancelable: true,
          })
        );
        streamController.enqueue(result);
        return {};
      },
    });

    kits?.forEach((kit) => scope.addHandlers(handlersFromKit(kit)));

    const callbacks = probe ? [createProbeCallbacks(probe)] : [];

    scope
      .invoke(this.#anyNode, callbacks)
      .finally(() => streamController.close());

    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  }

  // This is mostly copy & pasted from the original
  async runOnce(
    inputs: OriginalInputValues,
    context?: NodeHandlerContext
  ): Promise<OriginalOutputValues> {
    const args = { ...inputs, ...this.args };

    try {
      let outputs: OriginalOutputValues = {};

      for await (const result of this.run(context ?? {})) {
        if (result.type === "input") {
          // Pass the inputs to the board. If there are inputs bound to the board
          // (e.g. from a lambda node that had incoming wires), they will
          // overwrite supplied inputs.
          result.inputs = args;
        } else if (result.type === "output") {
          outputs = result.outputs;
          // Exit once we receive the first output.
          break;
        }
      }
      return outputs;
    } catch (e) {
      // Unwrap unhandled error (handled errors are just outputs of the board!)
      if ((e as { cause: string }).cause)
        return Promise.resolve({
          $error: (e as { cause: string }).cause,
        } as OriginalOutputValues);
      else throw e;
    }
  }

  // To discuss: This is the same as runOnce() above, but implemented in
  // parallel to run(), using different (and very simple) proxied input and
  // output nodes.
  async runOnce2(
    inputs: OriginalInputValues,
    context?: NodeHandlerContext
  ): Promise<OriginalOutputValues> {
    if (!this.#anyNode)
      throw new Error("Can't run board without any nodes in it");

    const args = { ...inputs, ...this.args };

    const scope = new Scope({
      declaringScope: this.#scope,
      invokingScope: getCurrentContextScope(),
    });

    context?.kits?.forEach((kit) => scope.addHandlers(handlersFromKit(kit)));

    let resolver: (outputs: OriginalOutputValues) => void;
    const promise = new Promise<OriginalOutputValues>((resolve) => {
      resolver = resolve;
    });

    scope.addHandlers({
      input: async () => {
        return args as InputValues;
      },
      output: async (inputs: InputsMaybeAsValues<InputValues>) => {
        resolver(inputs as OriginalOutputValues);
        return {};
      },
    });

    const callbacks = context?.probe
      ? [createProbeCallbacks(context.probe)]
      : [];

    // TODO: One big difference to before: This will keep running forever, even
    // after the first output is encountered. We need to add a way to abort the
    // run.
    scope.invoke(this.#anyNode, callbacks);

    return promise;
  }

  addValidator(_: BreadboardValidator): void {
    // TODO: Implement
  }

  static async fromNode(
    node: AbstractNode,
    metadata?: GraphMetadata
  ): Promise<Runner> {
    const board = new Runner();
    Object.assign(board, await node.serialize(metadata));
    board.#anyNode = node;
    return board;
  }

  static async fromGraphDescriptor(graph: GraphDescriptor): Promise<Runner> {
    const board = new Runner();
    board.nodes = graph.nodes;
    board.edges = graph.edges;
    board.args = graph.args;

    const nodes = new Map<string, BaseNode>();
    graph.nodes.forEach((node) => {
      const newNode = new BaseNode(
        node.type,
        board.#scope,
        node.configuration as InputValues
      );
      nodes.set(node.id, newNode);
      if (!board.#anyNode) board.#anyNode = newNode;
    });

    graph.edges.forEach((edge) => {
      const newEdge = {
        from: nodes.get(edge.from),
        to: nodes.get(edge.to),
        out: edge.out,
        in: edge.in,
        constant: edge.constant,
      } as EdgeInterface;
      newEdge.from.outgoing.push(newEdge);
      newEdge.to.incoming.push(newEdge);
    });

    return board;
  }

  static async load(
    url: string,
    options?: {
      base?: string;
      outerGraph?: GraphDescriptor;
    }
  ): Promise<Runner> {
    const graph = await OriginalBoardRunner.load(url, options);
    const board = await Runner.fromGraphDescriptor(graph);
    return board;
  }
}
