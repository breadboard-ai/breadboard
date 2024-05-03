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
  max: number;
};

const defaultPlan = JSON.stringify({
  max: 0,
} satisfies LooperPlan);

const examplePlan = JSON.stringify({
  max: 1,
} satisfies LooperPlan);

const counter = code(({ context, count }) => {
  const num = (count as number) - 1;
  if (num != 0) {
    return { continue: context, count: num };
  }
  return { stop: context };
});

export default await board(({ context, plan }) => {
  context
    .title("Context in")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default("[]")
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

  const count = counter({
    $metadata: { title: "Count Iteration" },
    context,
    count: plan,
  });

  return {
    context: count.stop.isArray().behavior("llm-content").title("Done"),
  };
}).serialize({
  title: "Looper",
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
});
