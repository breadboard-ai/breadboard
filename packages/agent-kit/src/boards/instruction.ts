/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
  board,
  code,
} from "@google-labs/breadboard";

export type InstructionType = NewNodeFactory<
  InstructionTypeInput,
  InstructionTypeOutput
>;

export type InstructionTypeInput = {
  /**
   * The context to use for the agent.
   */
  context?: NewNodeValue;
  /**
   * The prompt to use for the agent.
   */
  prompt: NewNodeValue;
};

export type InstructionTypeOutput = {
  /**
   * The context after generation.
   */
  context: NewNodeValue;
};

type ContextItem = {
  role: string;
  parts: { text: string }[];
};

const contextBuilder = code(({ context, prompt }) => {
  const list = (context as unknown[]) || [];
  if (list.length > 0) {
    const last = list[list.length - 1] as ContextItem;
    if (last.role === "user") {
      last.parts.push({ text: prompt as string });
      return { context: list };
    }
  }
  return {
    context: [...list, { role: "user", parts: [{ text: prompt }] }],
  };
});

export default await board(({ context, prompt }) => {
  context.title("Context").isArray().optional().default("[]");
  prompt.title("Prompt").isString().format("multiline")
    .examples(`You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Ready?

The topic is: the universe within us`);

  const { context: newContext } = contextBuilder({
    $id: "buildContext",
    context,
    prompt,
  });

  return { context: newContext };
}).serialize({
  title: "Instruction",
  description:
    "Use this board to specify an instruction for the agent. Think of it as a system prompt.",
});
