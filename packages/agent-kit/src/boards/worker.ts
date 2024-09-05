/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, array, board, input, string } from "@breadboard-ai/build";
import { NewNodeFactory, NewNodeValue } from "@google-labs/breadboard";
import { code } from "@google-labs/core-kit";
import gemini from "@google-labs/gemini-kit";
import { Context, contextType } from "../context.js";

export type WorkerType = NewNodeFactory<
  {
    /**
     * The context to use for the worker.
     */
    context?: NewNodeValue;
    /**
     * The instruction we want to give to the worker so that shapes its
     * character and orients it a bit toward the task we want to give it.
     */
    instruction: NewNodeValue;
    /**
     * The stop sequences to use for the worker.
     */
    stopSequences?: NewNodeValue;
  },
  {
    /**
     * The context after generation. Pass this to the next agent when chaining
     * them together.
     */
    context: NewNodeValue;
    /**
     * The output from the agent. Use this to just get the output without any
     * previous context.
     */
    text: NewNodeValue;
  }
>;

const context = input({
  title: "Context",
  type: array(contextType),
  examples: [[{ role: "user", parts: [{ text: "the universe within us" }] }]],
});

const instruction = input({
  title: "Instruction",
  type: annotate(string({ format: "multiline" }), { behavior: ["config"] }),
  examples: [
    `You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Look at the topic below and do your magic`,
  ],
});

const stopSequences = input({
  title: "Stop Sequences",
  type: annotate(array("string"), { behavior: ["config"] }),
  default: [],
});

const contextBuilder = code(
  { $metadata: { title: "Build Context" }, context, instruction },
  { context: array(contextType) },
  ({ context, instruction }) => {
    if (typeof context === "string") {
      // TODO(aomarks) Let's remove this and make all context array ports
      // totally consistent in their schemas, and create some helpers for
      // quickly doing e.g. string -> user text part.
      context = [{ role: "user", parts: [{ text: context }] }];
    }
    const list = context ?? [];
    if (list.length > 0) {
      const last = list[list.length - 1];
      if (last.role === "user") {
        // A trick: the instruction typically sits in front of the actual task
        // that the user requests. So do just that -- add it at the front of the
        // user part list, rather than at the end.
        last.parts.unshift({ text: instruction });
        return { context: list };
      }
    }
    return {
      context: [
        ...list,
        { role: "user", parts: [{ text: instruction }] },
      ] as const,
    };
  }
);

const generator = gemini.text({
  context: contextBuilder.outputs.context,
  stopSequences,
});

const contextAssembler = code(
  {
    $metadata: { title: "Assemble Context" },
    context: contextBuilder.outputs.context,
    generated: generator.outputs.context,
  },
  { context: array(contextType) },
  ({ context, generated }) => {
    if (!context) throw new Error("Context is required");
    return {
      context: [
        ...context,
        // TODO(aomarks) The types shared by gemini-kit and agent-kit have some
        // (probably minor) incompatibility. They should both use a common type
        // defined in some package.
        generated as Context,
      ],
    };
  }
);

export default board({
  title: "Worker",
  description: "The essential Agent building block",
  version: "0.0.1",
  metadata: {
    deprecated: true,
  },
  inputs: { context, instruction, stopSequences },
  outputs: {
    context: contextAssembler.outputs.context,
    text: generator.outputs.text,
  },
});
