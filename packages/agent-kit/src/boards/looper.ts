/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
  Schema,
  base,
  board,
  code,
} from "@google-labs/breadboard";
import { Context } from "../context.js";

export type LooperType = NewNodeFactory<
  {
    /**
     * The initial conversation context.
     */
    context?: NewNodeValue;
  },
  {
    /**
     * The final context after the repetitions.
     */
    context: NewNodeValue;
  }
>;

export type LooperPlan = {
  /**
   * Maximum iterations to make. This can be used to create simple
   * "repeat N times" loops.
   */
  max?: number;
  /**
   * Plan items. Each item represents one trip down the "Loop" output, and
   * at the end of the list, the "Context Out".
   */
  todo?: {
    task: string;
  }[];
  /**
   * Whether to append only the last item in the loop to the context or all
   * of them.
   */
  appendLast?: boolean;
  /**
   * Whether to return only last item from the context as the final product
   * or all of them;
   */
  returnLast?: boolean;
};

export const planSchema = {
  type: "object",
  properties: {
    max: {
      type: "number",
      description: "Maximum iterations to make, optional. Default is infinity",
    },
    todo: {
      type: "array",
      description:
        "Items in the plan, optional. Use this if the plan contains a definite, concrete list of items",
      items: {
        type: "object",
        description: "The object that represent an item in the plan",
        properties: {
          task: {
            type: "string",
            description:
              "The task description. Use action-oriented language, starting with a verb that fits the task",
          },
        },
      },
    },
  },
} satisfies Schema;

const defaultPlan = JSON.stringify({} satisfies LooperPlan);

const examplePlan = JSON.stringify({
  max: 1,
} satisfies LooperPlan);

const contextExample = JSON.stringify({
  parts: [{ text: "test" }],
  role: "user",
});

const planReader = code(({ context, plan }) => {
  type LooperData = {
    type: "looper";
    remaining: LooperPlan["todo"];
  };
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  if (!plan) {
    throw new Error("Plan is required for Looper to function.");
  }
  const p = plan as LooperPlan;
  const max = p.max || p.todo?.length || Infinity;
  const done: LooperData[] = [];
  // Collect all metadata entries in the context.
  // Gives us where we've been and where we're going.
  for (let i = existing.length - 1; i >= 0; i--) {
    const item = existing[i];
    if (item.role === "$metadata") {
      done.push(item.data as LooperData);
    }
  }
  const contents = structuredClone(existing) as Context[];
  const count = done.length;
  if (count >= max) {
    return { done: existing };
  }
  if (p.todo && Array.isArray(p.todo)) {
    const last = done[0] || { type: "looper", remaining: p.todo };
    const next = last.remaining?.shift();
    if (!next) {
      return { done: existing };
    }
    contents.push({ role: "$metadata", data: last });
    contents.push({ role: "user", parts: [{ text: next.task }] });
    return { context: contents };
  } else if (max) {
    const count = done.length;
    if (count >= max) {
      return { done: existing };
    }
    contents.push({ role: "$metadata", data: { type: "looper" } });
    return { context: contents };
  }
  return { done: existing };
});

export default await board(({ context, plan }) => {
  context
    .title("Context in")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default("[]")
    .examples(contextExample)
    .description("Initial conversation context");

  plan
    .title("Plan")
    .description("What to iterate over, and/or how many times")
    .isObject()
    .optional()
    .default(defaultPlan)
    .examples(examplePlan);

  const readPlan = planReader({
    $metadata: { title: "Read Plan" },
    context,
    plan,
  });

  base.output({
    $metadata: { title: "Exit" },
    done: readPlan.done.isArray().behavior("llm-content").title("Context Out"),
  });

  return {
    loop: readPlan.context.isArray().behavior("llm-content").title("Loop"),
  };
}).serialize({
  title: "Looper",
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
});
