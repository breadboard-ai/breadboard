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
  GraphMetadata,
  SubGraphs,
  BreadboardRunner,
  BreadboardSlotSpec,
  Kit,
  BreadboardValidator,
  NodeHandlerContext,
  ProbeDetails,
  BreadboardCapability,
  LambdaNodeInputs,
  LambdaNodeOutputs,
} from "./types.js";

import { TraversalMachine } from "./traversal/machine.js";
import {
  BeforeHandlerStageResult,
  InputStageResult,
  OutputStageResult,
  RunResult,
} from "./run.js";
import { BoardLoader } from "./loader.js";
import { runRemote } from "./remote.js";
import { callHandler } from "./handler.js";
import { toMermaid } from "./mermaid.js";
import { SchemaBuilder } from "./schema.js";
import { RequestedInputsManager, bubbleUpInputsIfNeeded } from "./bubble.js";
import { asyncGen } from "./utils/async-gen.js";

class ProbeEvent extends CustomEvent<ProbeDetails> {
  constructor(type: string, detail: ProbeDetails) {
    super(type, { detail, cancelable: true });
  }
}

/**
 * This class is the main entry point for running a board.
 *
 * It contains everything that is needed to run a board, either loaded from a
 * serialized board or created via the {Board} class.
 *
 * See the {Board} class for a way to build a board that can also be serialized.
 */
export class BoardRunner implements BreadboardRunner {
  // GraphDescriptor implementation.
  url?: string;
  title?: string;
  description?: string;
  version?: string;
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  kits: Kit[] = [];
  graphs?: SubGraphs;
  args?: InputValues;

  #slots: BreadboardSlotSpec = {};
  #validators: BreadboardValidator[] = [];
  /**
   * The parent board, if this is board is a subgraph of a larger board.
   */
  #outerGraph?: GraphDescriptor;

  /**
   *
   * @param metadata - optional metadata for the board. Use this parameter
   * to provide title, description, version, and URL for the board.
   */
  constructor(metadata?: GraphMetadata) {
    const { url, title, description, version } = metadata || {};
    Object.assign(this, { url, title, description, version });
  }

  /**
   * Runs the board. This method is an async generator that
   * yields the results of each stage of the run.
   *
   * Conceptually, when we ask the board to run, it will occasionally pause
   * and give us a chance to interact with it.
   *
   * It's typically used like this:
   *
   * ```js
   * for await (const stop of board.run()) {
   * // do something with `stop`
   * }
   * ```
   *
   * The `stop` iterator result will be a `RunResult` and provide ability
   * to influence running of the board.
   *
   * The two key use cases are providing input and receiving output.
   *
   * If `stop.type` is `input`, the board is waiting for input values.
   * When that is the case, use `stop.inputs` to provide input values.
   *
   * If `stop.type` is `output`, the board is providing output values.
   * When that is the case, use `stop.outputs` to receive output values.
   *
   * See [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.
   *
   * @param probe - an optional probe. If provided, the board will dispatch
   * events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
   * @param slots - an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.
   * @param result - an optional result of a previous run. If provided, the
   * board will resume from the state of the previous run.
   * @param kits - an optional map of kits to use when running the board.
   */
  async *run(
    context: NodeHandlerContext = {},
    result?: RunResult
  ): AsyncGenerator<RunResult> {
    yield* asyncGen(async (next) => {
      const handlers = await BoardRunner.handlersFromBoard(this, context.kits);
      const slots = { ...this.#slots, ...context.slots };
      this.#validators.forEach((validator) => validator.addGraph(this));

      const machine = new TraversalMachine(this, result?.state);

      const requestedInputs = new RequestedInputsManager(context);

      for await (const result of machine) {
        const { inputs, descriptor, missingInputs } = result;

        if (result.skip) {
          context?.probe?.dispatchEvent(
            new ProbeEvent("skip", { descriptor, inputs, missingInputs })
          );
          continue;
        }

        if (descriptor.type === "input") {
          await next(new InputStageResult(result));
          context?.probe?.dispatchEvent(
            new ProbeEvent("input", {
              descriptor,
              inputs,
              outputs: await result.outputsPromise,
            })
          );
          await bubbleUpInputsIfNeeded(this, context, result);
          continue;
        }

        if (descriptor.type === "output") {
          context.probe?.dispatchEvent(
            new ProbeEvent("output", { descriptor, inputs })
          );
          await next(new OutputStageResult(result));
          continue;
        }

        const handler = handlers[descriptor.type];
        if (!handler)
          throw new Error(`No handler for node type "${descriptor.type}"`);

        const beforehandlerDetail: ProbeDetails = {
          descriptor,
          inputs,
        };

        await next(new BeforeHandlerStageResult(result));

        const shouldInvokeHandler =
          !context.probe ||
          context.probe.dispatchEvent(
            new ProbeEvent("beforehandler", beforehandlerDetail)
          );

        const newContext: NodeHandlerContext = {
          ...context,
          board: this,
          descriptor,
          outerGraph: this.#outerGraph || this,
          base: this.url,
          slots,
          kits: [...(context.kits || []), ...this.kits],
          requestInput: requestedInputs.createHandler(next, result),
        };

        const outputsPromise = (
          shouldInvokeHandler
            ? callHandler(handler, inputs, newContext)
            : beforehandlerDetail.outputs instanceof Promise
            ? beforehandlerDetail.outputs
            : Promise.resolve(beforehandlerDetail.outputs)
        ) as Promise<OutputValues>;

        outputsPromise.then((outputs) => {
          context.probe?.dispatchEvent(
            new ProbeEvent("node", {
              descriptor,
              inputs,
              outputs,
              validatorMetadata: this.#validators.map((validator) =>
                validator.getValidatorMetadata(descriptor)
              ),
            })
          );
        });

        result.outputsPromise = outputsPromise;
      }
    });
  }

  /**
   * A simplified version of `run` that runs the board until the board provides
   * an output, and returns that output.
   *
   * This is useful for running boards that don't have multiple outputs
   * or the the outputs are only expected to be visited once.
   *
   * @param inputs - the input values to provide to the board.
   * @param probe - an optional probe. If provided, the board will dispatch
   * events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
   * @param slots - an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.
   * @param kits - an optional map of kits to use when running the board.
   * @returns - outputs provided by the board.
   */
  async runOnce(
    inputs: InputValues,
    context: NodeHandlerContext = {}
  ): Promise<OutputValues> {
    const args = { ...inputs, ...this.args };

    if (context.board && context.descriptor) {
      // If called from another node in a parent board, add the parent board's
      // validators to the board, with the current arguments.
      for (const validator of (context.board as this).#validators)
        this.addValidator(
          validator.getSubgraphValidator(context.descriptor, Object.keys(args))
        );
    }

    try {
      let outputs: OutputValues = {};

      for await (const result of this.run(context)) {
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
      if ((e as Error).cause)
        return { $error: (e as Error).cause } as OutputValues;
      else throw e;
    }
  }

  /**
   * Add validator to the board.
   * Will call .addGraph() on the validator before executing a graph.
   *
   * @param validator - a validator to add to the board.
   */
  addValidator(validator: BreadboardValidator) {
    this.#validators.push(validator);
  }

  /**
   * Returns a [Mermaid](https://mermaid-js.github.io/mermaid/#/) representation
   * of the board.
   *
   * This is useful for visualizing the board.
   *
   * @returns - a string containing the Mermaid representation of the board.
   */
  mermaid(direction = "TD", unstyled = false): string {
    return toMermaid(this, direction, unstyled);
  }

  /**
   * Creates a new board from JSON. If you have a serialized board, you can
   * use this method to turn it into into a new Board instance.
   *
   * @param graph - the JSON representation of the board.
   * @returns - a new `Board` instance.
   */
  static async fromGraphDescriptor(
    graph: GraphDescriptor
  ): Promise<BoardRunner> {
    const breadboard = new BoardRunner(graph);
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    breadboard.graphs = graph.graphs;
    breadboard.args = graph.args;
    return breadboard;
  }

  /**
   * Loads a board from a URL or a file path.
   *
   * @param url - the URL or a file path to the board.
   * @param slots - optional slots to provide to the board.
   * @returns - a new `Board` instance.
   */
  static async load(
    url: string,
    options?: {
      slotted?: BreadboardSlotSpec;
      base?: string;
      outerGraph?: GraphDescriptor;
    }
  ): Promise<BoardRunner> {
    const { base, slotted, outerGraph } = options || {};
    const loader = new BoardLoader({
      base,
      graphs: outerGraph?.graphs,
    });
    const { isSubgraph, graph } = await loader.load(url);
    const board = await BoardRunner.fromGraphDescriptor(graph);
    if (isSubgraph) board.#outerGraph = outerGraph;
    board.#slots = slotted || {};
    return board;
  }

  /**
   * Creates a runnable board from a BreadboardCapability,
   * @param board {BreadboardCapability} A BreadboardCapability including a board
   * @returns {Board} A runnable board.
   */
  static async fromBreadboardCapability(
    board: BreadboardCapability
  ): Promise<BoardRunner> {
    if (board.kind !== "board" || !(board as BreadboardCapability).board) {
      throw new Error(`Expected a "board" Capability, but got ${board}`);
    }

    // TODO: Use JSON schema to validate rather than this hack.
    const boardish = (board as BreadboardCapability).board as GraphDescriptor;
    if (!(boardish.edges && boardish.kits && boardish.nodes)) {
      throw new Error(
        'Supplied "board" Capability argument is not actually a board'
      );
    }

    // If all we got is a GraphDescriptor, build a runnable board from it.
    // TODO: Use JSON schema to validate rather than this hack.
    let runnableBoard = (board as BreadboardCapability).board as BoardRunner;
    if (!runnableBoard.runOnce) {
      runnableBoard = await BoardRunner.fromGraphDescriptor(boardish);
    }

    return runnableBoard;
  }
  static async handlersFromBoard(
    board: BoardRunner,
    upstreamKits: Kit[] = []
  ): Promise<NodeHandlers> {
    const core = new Core();
    const kits = [core, ...upstreamKits, ...board.kits];

    return kits.reduce((handlers, kit) => {
      // If multiple kits have the same handler, the kit earlier in the list
      // gets precedence, including upstream kits getting precedence over kits
      // defined in the graph.
      //
      // TODO: This means kits are fallback, consider non-fallback as well.
      return { ...kit.handlers, ...handlers };
    }, {} as NodeHandlers);
  }

  static runRemote = runRemote;
}

// HACK: Move the Core and Lambda logic into the same file as the BoardRunner to remove the cyclic module dependency (Lambda needs BoardRunner, BoardRunner needs Core).
class Core {
  handlers: NodeHandlers;

  constructor() {
    this.handlers = {
      lambda: {
        describe: async (inputs?: InputValues) => ({
          inputSchema: new SchemaBuilder()
            .setAdditionalProperties(true)
            .addInputs(inputs)
            .addProperty("board", {
              title: "board",
              description: "The board to run.",
              type: "object",
            })
            .build(),
          outputSchema: new SchemaBuilder()
            .addProperty("board", {
              title: "board",
              description: "The now-runnable board.",
              type: "object",
            })
            .build(),
        }),
        invoke: async (inputs: InputValues): Promise<LambdaNodeOutputs> => {
          const { board, ...args } = inputs as LambdaNodeInputs;
          if (!board || board.kind !== "board" || !board.board)
            throw new Error(
              `Lambda node requires a BoardCapability as "board" input`
            );
          const runnableBoard = {
            ...(await BoardRunner.fromBreadboardCapability(board)),
            args,
          };

          return {
            board: { ...board, board: runnableBoard as GraphDescriptor },
          };
        },
      },
    };
  }
}
