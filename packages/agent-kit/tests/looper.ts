/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { planReaderFunction } from "../src/boards/looper.js";
import { throws, deepStrictEqual } from "node:assert";
import { Context, LooperPlan } from "../src/context.js";

const tasks = (...tasks: string[]): LooperPlan => {
  return {
    todo: tasks.map((task) => ({ task })),
  };
};

describe("planReader", () => {
  test("throws when no plan is supplied", () => {
    throws(() => {
      planReaderFunction({});
    });
  });

  test("correctly shifts tasks", () => {
    const context: Context[] = [];
    const progress = tasks("Task 1", "Task 2");
    const result = planReaderFunction({
      context,
      progress,
    });
    deepStrictEqual(result, {
      context: [
        {
          role: "$metadata",
          data: {
            todo: [{ task: "Task 2" }],
            next: "Task 1",
          } satisfies LooperPlan,
        },
      ],
    });
  });

  test("favors todo over doneMarker when both are present", () => {
    const context: Context[] = [];
    const progress = tasks("Task 1", "Task 2");
    progress.doneMarker = "marker";
    const result = planReaderFunction({
      context,
      progress,
    });
    deepStrictEqual(result, {
      context: [
        {
          role: "$metadata",
          data: {
            todo: [{ task: "Task 2" }],
            next: "Task 1",
          } satisfies LooperPlan,
        },
      ],
    });
  });
});
