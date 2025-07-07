/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, NodeIdentifier, Outcome } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import assert, { deepStrictEqual } from "node:assert";
import { describe, it } from "node:test";
import { createPlan } from "../../src/static/create-plan.js";
import { Orchestrator } from "../../src/static/orchestrator.js";
import {
  NodeState,
  OrchestrationNodeInfo,
  Task,
} from "../../src/static/types.js";

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

const router: GraphDescriptor = {
  nodes: [
    { id: "choose-path", type: "sign" },
    { id: "left-path", type: "path" },
    { id: "right-path", type: "path" },
    { id: "treasure", type: "item" },
    { id: "dragon", type: "item" },
  ],
  edges: [
    { from: "choose-path", out: "left", to: "left-path", in: "travel" },
    { from: "choose-path", out: "right", to: "right-path", in: "travel" },
    { from: "left-path", out: "arrive", to: "treasure", in: "encounter" },
    { from: "right-path", out: "arrive", to: "dragon", in: "encounter" },
  ],
};

const routerPlan = createPlan(router);

function assertState(
  graph: GraphDescriptor,
  state: Map<NodeIdentifier, OrchestrationNodeInfo>,
  expected: [id: NodeIdentifier, state: NodeState][]
) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  deepStrictEqual(
    state,
    new Map(
      expected.map(([id, state]) => [id, { node: nodeMap.get(id), state }])
    )
  );
}

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
    it("should advance through the diamond graph", () => {
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
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "ready"],
          ["mixer", "waiting"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("left-channel", {
          processed: "processed-left-audio",
        });
        deepStrictEqual(progress, "working");
        assertTasks(orchestrator.currentTasks(), ["right-channel"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "succeeded"],
          ["right-channel", "ready"],
          ["mixer", "waiting"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("right-channel", {
          processed: "processed-right-audio",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["mixer"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "succeeded"],
          ["right-channel", "succeeded"],
          ["mixer", "ready"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("mixer", {
          result: "mixed-audio",
        });
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "succeeded"],
          ["right-channel", "succeeded"],
          ["mixer", "succeeded"],
        ]);
      }
    });

    it("should handle missing inputs in the diamong graph", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      assertTasks(orchestrator.currentTasks(), ["input"]);
      {
        const progress = orchestrator.provideOutputs("input", {
          left: "left-audio",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["left-channel"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "skipped"],
          ["mixer", "waiting"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("left-channel", {
          processed: "processed-left-audio",
        });
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "succeeded"],
          ["right-channel", "skipped"],
          ["mixer", "skipped"],
        ]);
      }
    });

    it("should handle errors at the diverge part of the diamong graph", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      assertTasks(orchestrator.currentTasks(), ["input"]);
      {
        const progress = orchestrator.provideOutputs("input", {
          $error: "Unable to get input",
        });
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
        assertState(diamond, orchestrator.state(), [
          ["input", "failed"],
          ["left-channel", "skipped"],
          ["right-channel", "skipped"],
          ["mixer", "skipped"],
        ]);
      }
    });

    it("should handle errors at the converge part of the diamong graph", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      assertTasks(orchestrator.currentTasks(), ["input"]);
      {
        const progress = orchestrator.provideOutputs("input", {
          left: "left-audio",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["left-channel"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "skipped"],
          ["mixer", "waiting"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("left-channel", {
          $error: "Unable to process",
        });
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "failed"],
          ["right-channel", "skipped"],
          ["mixer", "skipped"],
        ]);
      }
    });

    it("should advanced through the router graph", () => {
      const orchestrator = new Orchestrator(routerPlan);
      assertTasks(orchestrator.currentTasks(), ["choose-path"]);
      {
        const progress = orchestrator.provideOutputs("choose-path", {
          left: "left",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["left-path"]);
        assertState(router, orchestrator.state(), [
          ["choose-path", "succeeded"],
          ["left-path", "ready"],
          ["right-path", "skipped"],
          ["treasure", "waiting"],
          ["dragon", "waiting"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("left-path", {
          arrive: "treasure",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["treasure"]);
        assertState(router, orchestrator.state(), [
          ["choose-path", "succeeded"],
          ["left-path", "succeeded"],
          ["right-path", "skipped"],
          ["treasure", "ready"],
          ["dragon", "skipped"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("treasure", {
          result: "treasure",
        });
        assertTasks(orchestrator.currentTasks(), []);
        deepStrictEqual(progress, "finished");
        assertState(router, orchestrator.state(), [
          ["choose-path", "succeeded"],
          ["left-path", "succeeded"],
          ["right-path", "skipped"],
          ["treasure", "succeeded"],
          ["dragon", "skipped"],
        ]);
      }
    });
  });
});
