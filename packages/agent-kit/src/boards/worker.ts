/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NewNodeFactory, NewNodeValue, board } from "@google-labs/breadboard";
import { gemini } from "@google-labs/gemini-kit";
import { contextAssembler, contextBuilder } from "../context.js";

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

const sampleInstruction = `You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Look at the topic below and do your magic`;

const sampleContext = `the universe within us`;

export default await board(({ context, instruction, stopSequences }) => {
  context.title("Context").isArray().examples(sampleContext);
  instruction
    .title("Instruction")
    .format("multiline")
    .examples(sampleInstruction);
  stopSequences.title("Stop Sequences").isArray().optional().default("[]");

  const buildContext = contextBuilder({
    $id: "buildContext",
    context,
    instruction,
  });

  const { context: generated, text: output } = gemini.text({
    $id: "generate",
    context: buildContext.context,
    stopSequences,
    text: "unused", // A gross hack (see TODO in gemini-generator.ts)
  });

  const assembleContext = contextAssembler({
    $id: "assembleContext",
    generated,
    context: buildContext.context,
  });

  assembleContext.context
    .title("Context")
    .isObject()
    .description("Agent context after generation");
  output.title("Output").isString().description("Agent's output");

  return { context: assembleContext.context, text: output };
}).serialize({
  title: "Worker",
  description: "The essential Agent building block",
  version: "0.0.1",
});
