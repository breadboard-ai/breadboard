/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  constant,
  converge,
  input,
  loopback,
  object,
  outputNode,
} from "@breadboard-ai/build";
import { code, invoke } from "@google-labs/core-kit";
import { contextType } from "../context.js";

const inputContext = input({
  title: "Context",
  type: array(contextType),
  description: "Initial conversation context",
  default: [],
});

const max = input({
  title: "Max",
  description:
    "The maximum number of repetitions to make (set to -1 to go infinitely)",
  type: "number",
  default: -1,
  examples: [3],
});

const worker = input({
  title: "Worker",
  description: "Worker to repeat",
  type: annotate(object({}), {
    behavior: ["board"],
  }),
});

const counterContinue = loopback({ type: array(contextType) });
const workerInvoke = invoke({
  $metadata: { title: "Invoke Worker" },
  $board: constant(worker),
  context: converge(inputContext, counterContinue),
});

const workerExitOutput = outputNode(
  { context: workerInvoke.unsafeOutput("exit") },
  { title: "Exit" }
);

const counterCount = loopback({ type: "number" });
const counter = code(
  {
    $metadata: { title: "Counter" },
    context: workerInvoke.unsafeOutput("context"),
    count: converge(max, counterCount),
  },
  {
    continue: array(contextType),
    stop: array(contextType),
    count: "number",
  },
  ({ context, count }) => {
    const num = count - 1;
    if (num !== 0) {
      // TODO(aomarks) This cast is because we don't support optional outputs
      // from the code helper yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { continue: context, count: num } as any;
    }
    // TODO(aomarks) This cast is because we don't support optional outputs
    // from the code helper yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { stop: context } as any;
  }
);
counterCount.resolve(counter.outputs.count);
counterContinue.resolve(counter.outputs.continue);

const counterExitOutput = outputNode({
  context: counter.outputs.stop,
});

export default board({
  title: "Repeater",
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
  metadata: {
    deprecated: true,
  },
  inputs: { max, context: inputContext, worker },
  outputs: [workerExitOutput, counterExitOutput],
});
