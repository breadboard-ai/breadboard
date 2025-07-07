/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, Outcome } from "@breadboard-ai/types";
import { createPlan } from "../../src/static/create-plan.js";
import { describe, it } from "node:test";
import { Orchestrator } from "../../src/static/orchestrator.js";
import assert, { deepStrictEqual } from "node:assert";
import { ok } from "@breadboard-ai/utils";
import { Task } from "../../src/static/types.js";

const diamond: GraphDescriptor = {
  nodes: [
    { id: "input", type: "input" },
    { id: "left-channel", type: "process" },
    { id: "right-channel", type: "process" },
    { id: "mixer", type: "mix" },
  ],
  edges: [
    { from: "input", out: "left", to: "left-channel", in: "signal" },
    { from: "input", out: "right", to: "right-channel", in: "signal" },
    { from: "left-channel", out: "processed", to: "mixer", in: "left" },
    { from: "right-channel", out: "processed", to: "mixer", in: "right" },
  ],
};

const diamondPlan = createPlan(diamond);

function assertTasks(tasks: Outcome<Task[]>, names: string[]) {
  assert(ok(tasks));
  if (ok(tasks)) {
    deepStrictEqual(
      tasks.map((task) => task.node.id),
      names
    );
  }
}

describe("Orchestrator", () => {
  describe("advancing stages", () => {
    it("should correctly advance through stages", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      assertTasks(orchestrator.currentTasks(), ["input"]);
      {
        const progress = orchestrator.provideOutputs("input", {
          left: "left-audio",
          right: "right-audio",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), [
          "left-channel",
          "right-channel",
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("left-channel", {
          processed: "processed-left-audio",
        });
        deepStrictEqual(progress, "working");
        assertTasks(orchestrator.currentTasks(), ["right-channel"]);
      }
      {
        const progress = orchestrator.provideOutputs("right-channel", {
          processed: "processed-right-audio",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["mixer"]);
      }
      {
        const progress = orchestrator.provideOutputs("mixer", {
          result: "mixed-audio",
        });
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
      }
    });
  });
});
