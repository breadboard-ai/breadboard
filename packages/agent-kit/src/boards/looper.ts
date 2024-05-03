/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
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
   * "repeat N times" loops as well as
   */
  max?: number;
};

const defaultPlan = JSON.stringify({} satisfies LooperPlan);

const examplePlan = JSON.stringify({
  max: 1,
} satisfies LooperPlan);

const contextExample = JSON.stringify({
  parts: [{ text: "test" }],
  role: "user",
});

const planReader = code(({ context, plan }) => {
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  if (!plan) {
    throw new Error("Plan is required for Looper to function.");
  }
  const p = plan as LooperPlan;
  if (p.max) {
    // Look for metadata in the context, and return the first one
    let count = 0;
    for (let i = existing.length - 1; i >= 0; i--) {
      const item = existing[i];
      if (item.role === "$metadata") {
        count++;
      }
    }
    const max = (plan as LooperPlan).max || 0;
    if (count >= max) {
      return { done: existing };
    }
    const contents = structuredClone(existing) as Context[];
    contents.push({
      role: "$metadata",
      data: {
        type: "looper",
        count,
      },
    });
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
    .description(
      "For now, the maximum number of repetitions to make (set to -1 to go infinitely)"
    )
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
    done: readPlan.done.isArray().behavior("llm-content").title("Done"),
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
