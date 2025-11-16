/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "../../src/legacy/index.js";
import type {
  BreadboardCapability,
  GraphDescriptor,
  GraphDescriptorBoardCapability,
  InputValues,
  NodeDescriberResult,
  Schema,
} from "../../src/types.js";

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
  include: async () => {
    throw new Error("Not meant to run");
  },
  /**
   * This is a primitive implementation of the `invoke` node in Core Kit,
   * just enough for testing.
   */
  invoke: {
    invoke: async () => {
      throw new Error("Not meant to be run");
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
});
