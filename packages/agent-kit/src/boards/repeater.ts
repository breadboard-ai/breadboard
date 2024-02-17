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
import { core } from "@google-labs/core-kit";

export type RepeaterType = NewNodeFactory<
  {
    /**
     * The initial conversation context.
     */
    context?: NewNodeValue;
    /**
     * The worker to repeat.
     */
    worker: NewNodeValue;
    /**
     * The maximum number of repetitions to make (set to -1 to go infinitely).
     */
    max?: NewNodeValue;
  },
  {
    /**
     * The final context after the repetitions.
     */
    context: NewNodeValue;
  }
>;

const counter = code(({ context, count }) => {
  const num = (count as number) - 1;
  if (num != 0) {
    return { continue: context, count: num };
  }
  return { stop: context };
});

export default await board(({ context, worker, max }) => {
  context
    .title("Context")
    .isArray()
    .format("multiline")
    .optional()
    .default("[]")
    .description("Initial conversation context");
  max
    .title("Max")
    .description(
      "The maximum number of repetitions to make (set to -1 to go infinitely)"
    )
    .isNumber()
    .optional()
    .default("-1")
    .examples("3");

  worker.title("Worker").description("Worker to repeat").isObject();

  const invokeAgent = core.invoke({
    $id: "invokeAgent",
    $board: worker.memoize(),
    context,
  });

  const count = counter({
    $id: "counter",
    context: invokeAgent.context,
    count: max,
  });

  count.continue.as("context").to(invokeAgent);
  count.count.to(count);

  return { context: count.stop };
}).serialize({
  title: "Repeater",
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
});
