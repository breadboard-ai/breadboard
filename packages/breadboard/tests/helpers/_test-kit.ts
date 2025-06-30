/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamCapability } from "@breadboard-ai/runtime/legacy.js";
import { KitBuilder } from "../../src/kits/index.js";
import type {
  BreadboardCapability,
  GraphDescriptor,
  GraphDescriptorBoardCapability,
  InputValues,
  NodeDescriberResult,
  NodeHandlerContext,
  Schema,
} from "../../src/types.js";

type IncludeInputValues = InputValues & {
  graph?: GraphDescriptor;
};

type InvokeInputValues = InputValues & {
  board?: BreadboardCapability;
  path?: string;
};
/**
 * This is a Kit designed specifically for use in the testing harness.
 */
export const TestKit = new KitBuilder({
  url: ".",
}).build({
  /**
   * Just a no-op node.
   * @param inputs Any inputs to the node.
   * @returns Sme inputs
   */
  noop: async (inputs) => inputs,
  /**
   * Just a no-op node, called "test, for when need two noop nodes with
   * different names. This is useful for testing that the name is stripped
   * from the regular "noop".
   * @param inputs Any inputs to the node.
   * @returns Sme inputs
   */
  test: async (inputs) => inputs,
  /**
   * This is a primitive implementation of the `include` node in Core Kit,
   * just enough for testing.
   */
  include: async (inputs: InputValues, context: NodeHandlerContext) => {
    const { graph } = inputs as IncludeInputValues;
    if (!graph) {
      throw new Error("Must provide a graph to include");
    }
    return await invokeGraph({ graph }, inputs, context);
  },
  /**
   * This is a primitive implementation of the `invoke` node in Core Kit,
   * just enough for testing.
   */
  invoke: {
    invoke: async (inputs: InvokeInputValues, context: NodeHandlerContext) => {
      const { $board, ...args } = inputs;
      const base = context.base || new URL(import.meta.url);

      if ($board) {
        let result = undefined;
        if (($board as BreadboardCapability).kind === "board") {
          result = await getGraphDescriptor(
            $board as BreadboardCapability,
            context
          );
        } else if (typeof $board === "string") {
          result = await context.loader?.load($board, {
            base,
            outerGraph: context.outerGraph,
          });
        }

        if (!result) throw new Error("Must provide valid $board to invoke");

        if (!result.success) {
          throw new Error(result.error);
        }

        return await invokeGraph(result, args, context);
      } else {
        const { board, path, ...args } = inputs;

        const result = board
          ? await getGraphDescriptor(board, context)
          : path
            ? await context.loader?.load(path, {
                base,
                outerGraph: context.outerGraph,
              })
            : undefined;

        if (!result) {
          throw new Error("Must provide valid board to invoke");
        }
        if (!result.success) {
          throw new Error(result.error);
        }

        return await invokeGraph(result, args, context);
      }
    },
    describe: async (inputs?: InputValues): Promise<NodeDescriberResult> => {
      // Bare subset of describe() for invoke: Find the first input and output
      // nodes of inline supplied graphs (no loading), and use their schemas.
      let graph: GraphDescriptor | undefined = undefined;
      if (
        inputs?.$board &&
        (inputs?.$board as BreadboardCapability).kind === "board"
      ) {
        graph = (inputs?.$board as GraphDescriptorBoardCapability).board;
      } else if (
        inputs?.board &&
        (inputs.board as BreadboardCapability).kind === "board"
      ) {
        graph = (inputs.board as GraphDescriptorBoardCapability).board;
      } else if (inputs?.graph) {
        graph = inputs.graph as GraphDescriptor;
      }

      const inputSchema =
        (graph?.nodes.find((n) => n.type === "input" && n.configuration?.schema)
          ?.configuration?.schema as Schema) ?? {};
      const outputSchema =
        (graph?.nodes.find(
          (n) => n.type === "output" && n.configuration?.schema
        )?.configuration?.schema as Schema) ?? {};

      return { inputSchema, outputSchema };
    },
  },
  /**
   * Reverses provided string inputs. Will crash if provided non-string inputs.
   * @param inputs InputValues
   */
  reverser: {
    invoke: async (inputs) => {
      return Object.fromEntries(
        Object.entries(inputs).map(([key, value]) => [
          key,
          (inputs[key] = [...(value as string)].reverse().join("")),
        ])
      );
    },
    describe: async (
      inputs?: InputValues,
      inputSchema?: Schema
    ): Promise<NodeDescriberResult> => {
      const ports = [
        ...Object.keys(inputs ?? {}),
        ...Object.keys(inputSchema?.properties ?? {}),
      ];

      const schema = (op: string) => ({
        title: "Reverser",
        description: "Reverses the provided string inputs",
        type: "object",
        properties: Object.fromEntries(
          ports.map((port) => [
            port,
            {
              type: "string",
              title: inputSchema?.properties?.[port]?.title ?? port,
              description:
                op +
                (inputSchema?.properties?.[port]?.description ??
                  inputSchema?.properties?.[port]?.title ??
                  port),
            },
          ])
        ),
        additionalProperties: Object.entries(inputs ?? {}).length === 0,
      });

      return {
        inputSchema: schema("Reverse: "),
        outputSchema: schema("Reversed: "),
      };
    },
  },
  /**
   * Supplies a simple stream output that can be used to test interactions with
   * streams.
   */
  streamer: async () => {
    const words = "Breadboard is a project that helps you make AI boards.";
    const stream = new ReadableStream({
      start(controller) {
        for (const word of words.split(" ")) {
          controller.enqueue(`${word} `);
        }
        controller.close();
      },
    });
    return { stream: new StreamCapability(stream) };
  },
  /**
   * Unsafe JS runner. Needed to test serializing boards that are pure code.
   */
  runJavascript: async (inputs) => {
    const { code, name, raw, ...rest } = inputs;
    const result = eval(
      `${code} (async () => { return await ${name}(${JSON.stringify(
        rest
      )}); })();`
    );
    return raw ? result : { result };
  },
});

/**
 * Board grammar versions of the above, with types.
 */
import { getGraphDescriptor } from "@breadboard-ai/runtime/legacy.js";
import { invokeGraph } from "../../src/index.js";
