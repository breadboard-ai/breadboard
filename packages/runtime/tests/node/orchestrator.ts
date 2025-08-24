/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeIdentifier,
  Outcome,
  NodeLifecycleState,
  OrchestrationNodeInfo,
  Task,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import assert, { deepStrictEqual } from "node:assert";
import { describe, it } from "node:test";
import { createPlan } from "../../src/static/create-plan.js";
import { Orchestrator } from "../../src/static/orchestrator.js";

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

const zigZag: GraphDescriptor = {
  nodes: [
    { id: "a", type: "walk" },
    { id: "b", type: "walk" },
    { id: "c", type: "walk" },
    { id: "d", type: "walk" },
    { id: "e", type: "walk" },
    { id: "f", type: "walk" },
  ],
  edges: [
    { from: "a", out: "context", to: "b", in: "context" },
    { from: "b", out: "context", to: "c", in: "context" },
    { from: "d", out: "context", to: "c", in: "context" },
    { from: "d", out: "context", to: "e", in: "context" },
    { from: "e", out: "context", to: "f", in: "context" },
  ],
};

const zigZagPlan = createPlan(zigZag);

function assertState(
  graph: GraphDescriptor,
  state: ReadonlyMap<NodeIdentifier, OrchestrationNodeInfo>,
  expected: [id: NodeIdentifier, state: NodeLifecycleState][]
) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  deepStrictEqual(
    new Map(state),
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
      deepStrictEqual(orchestrator.progress, "initial");
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
          ["mixer", "inactive"],
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
          ["mixer", "inactive"],
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
        deepStrictEqual(progress, "finished");
        assertTasks(orchestrator.currentTasks(), []);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "skipped"],
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
          ["mixer", "inactive"],
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
  });

  describe("skip/failure propagation", () => {
    it("should advance through the router graph", () => {
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
          ["treasure", "inactive"],
          ["dragon", "skipped"],
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

    it("should propagate skipped state through zig-zag graph", () => {
      const orchestrator = new Orchestrator(zigZagPlan);
      assertTasks(orchestrator.currentTasks(), ["a", "d"]);
      {
        const progress = orchestrator.provideOutputs("a", {
          context: "context",
        });
        deepStrictEqual(progress, "working");
        assertTasks(orchestrator.currentTasks(), ["d"]);
        assertState(zigZag, orchestrator.state(), [
          ["a", "succeeded"],
          ["b", "inactive"],
          ["c", "inactive"],
          ["d", "ready"],
          ["e", "inactive"],
          ["f", "inactive"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("d", {
          context: "context",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["b", "e"]);
        assertState(zigZag, orchestrator.state(), [
          ["a", "succeeded"],
          ["b", "ready"],
          ["c", "inactive"],
          ["d", "succeeded"],
          ["e", "ready"],
          ["f", "inactive"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("b", {
          $error: "failure",
        });
        deepStrictEqual(progress, "working");
        assertTasks(orchestrator.currentTasks(), ["e"]);
        assertState(zigZag, orchestrator.state(), [
          ["a", "succeeded"],
          ["b", "failed"],
          ["c", "skipped"],
          ["d", "succeeded"],
          ["e", "ready"],
          ["f", "inactive"],
        ]);
      }
      {
        const progress = orchestrator.provideOutputs("e", {
          context: "context",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["f"]);
        assertState(zigZag, orchestrator.state(), [
          ["a", "succeeded"],
          ["b", "failed"],
          ["c", "skipped"],
          ["d", "succeeded"],
          ["e", "succeeded"],
          ["f", "ready"],
        ]);
      }
    });
  });

  describe("setting working/waiting/interrupted states", () => {
    it("should error out on non-existing nodes", () => {
      const orchestrator = new Orchestrator(routerPlan);
      {
        const outcome = orchestrator.setWorking("non-existing");
        assert(!ok(outcome));
      }
      {
        const outcome = orchestrator.setWaiting("non-existing");
        assert(!ok(outcome));
      }
      {
        const outcome = orchestrator.setInterrupted("non-existing");
        assert(!ok(outcome));
      }
    });
    it("should reject setting states outside of lifecycle", () => {
      const orchestrator = new Orchestrator(routerPlan);
      {
        const outcome = orchestrator.setWorking("left-path");
        assert(!ok(outcome));
      }
      {
        const outcome = orchestrator.setWaiting("left-path");
        assert(!ok(outcome));
      }
      {
        const outcome = orchestrator.setInterrupted("choose-path");
        assert(!ok(outcome));
      }
    });
    it("should correctly follow the lifecycle", () => {
      const orchestrator = new Orchestrator(routerPlan);
      assertTasks(orchestrator.currentTasks(), ["choose-path"]);
      {
        const outcome = orchestrator.setWorking("choose-path");
        assert(ok(outcome));
      }
      assertTasks(orchestrator.currentTasks(), ["choose-path"]);
      {
        const outcome = orchestrator.setWaiting("choose-path");
        assert(ok(outcome));
      }
      assertTasks(orchestrator.currentTasks(), ["choose-path"]);
      {
        const progress = orchestrator.provideOutputs("choose-path", {
          left: "left",
        });
        assert(!ok(progress));
        assertTasks(orchestrator.currentTasks(), ["choose-path"]);
      }
      {
        const outcome = orchestrator.setWorking("choose-path");
        assert(ok(outcome));
        const progress = orchestrator.provideOutputs("choose-path", {
          left: "left",
        });
        deepStrictEqual(progress, "advanced");
        assertTasks(orchestrator.currentTasks(), ["left-path"]);
      }
      {
        const outcome = orchestrator.setWorking("left-path");
        assert(ok(outcome));
      }
      {
        const outcome = orchestrator.setInterrupted("left-path");
        assert(ok(outcome));
        assertTasks(orchestrator.currentTasks(), []);
        assertState(router, orchestrator.state(), [
          ["choose-path", "succeeded"],
          ["left-path", "interrupted"],
          ["right-path", "skipped"],
          ["treasure", "skipped"],
          ["dragon", "skipped"],
        ]);
      }
    });
  });

  describe("failure handling", () => {
    it("should correctly report multiple failures", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      orchestrator.provideOutputs("input", {
        left: "left-audio",
        right: "right-audio",
      });
      deepStrictEqual(orchestrator.progress, "advanced");

      orchestrator.provideOutputs("left-channel", {
        $error: "Failed left channel",
      });
      deepStrictEqual(orchestrator.progress, "finished");
      assertState(diamond, orchestrator.state(), [
        ["input", "succeeded"],
        ["left-channel", "failed"],
        ["right-channel", "skipped"],
        ["mixer", "skipped"],
      ]);
      // Often, the outputs from the same phase arrive regardless of
      // whether or not orchestrator already finished.
      // So, the orchestrator should correctly record those outputs.
      orchestrator.provideOutputs("right-channel", {
        $error: "Failed right channel",
      });
      deepStrictEqual(orchestrator.progress, "finished");
      assertState(diamond, orchestrator.state(), [
        ["input", "succeeded"],
        ["left-channel", "failed"],
        ["right-channel", "failed"],
        ["mixer", "skipped"],
      ]);
    });

    it("should correctly report success after failures", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      orchestrator.provideOutputs("input", {
        left: "left-audio",
        right: "right-audio",
      });
      deepStrictEqual(orchestrator.progress, "advanced");

      orchestrator.provideOutputs("left-channel", {
        $error: "Failed left channel",
      });
      deepStrictEqual(orchestrator.progress, "finished");
      assertState(diamond, orchestrator.state(), [
        ["input", "succeeded"],
        ["left-channel", "failed"],
        ["right-channel", "skipped"],
        ["mixer", "skipped"],
      ]);
      // Often, the outputs from the same phase arrive regardless of
      // whether or not orchestrator already finished.
      // So, the orchestrator should correctly record those outputs.
      orchestrator.provideOutputs("right-channel", {
        processed: "processed-right-audio",
      });
      deepStrictEqual(orchestrator.progress, "finished");
      assertState(diamond, orchestrator.state(), [
        ["input", "succeeded"],
        ["left-channel", "failed"],
        ["right-channel", "succeeded"],
        ["mixer", "skipped"],
      ]);
    });
  });

  describe("progress status", () => {
    it("should correctly report progress", () => {
      const orchestrator = new Orchestrator(diamondPlan);
      assertTasks(orchestrator.currentTasks(), ["input"]);
      {
        orchestrator.provideOutputs("input", {
          left: "left-audio",
          right: "right-audio",
        });
        deepStrictEqual(orchestrator.progress, "advanced");
      }
      {
        orchestrator.provideOutputs("left-channel", {
          processed: "processed-left-audio",
        });
        deepStrictEqual(orchestrator.progress, "working");
      }
      {
        orchestrator.provideOutputs("right-channel", {
          processed: "processed-right-audio",
        });
        deepStrictEqual(orchestrator.progress, "advanced");
      }
      {
        orchestrator.provideOutputs("mixer", {
          result: "mixed-audio",
        });
        deepStrictEqual(orchestrator.progress, "finished");
      }
    });
  });

  describe("restartAtNode", () => {
    it("should correctly restart at a node", () => {
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
          ["mixer", "inactive"],
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
          ["mixer", "inactive"],
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
        const rollback = orchestrator.restartAtNode("left-channel");
        assert(ok(rollback));
        deepStrictEqual(orchestrator.progress, "working");
        assertTasks(orchestrator.currentTasks(), ["left-channel"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "succeeded"],
          ["mixer", "inactive"],
        ]);
      }
      {
        const rollback = orchestrator.restartAtNode("right-channel");
        assert(ok(rollback));
        deepStrictEqual(orchestrator.progress, "advanced");
        assertTasks(orchestrator.currentTasks(), [
          "left-channel",
          "right-channel",
        ]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "ready"],
          ["mixer", "inactive"],
        ]);
      }
      {
        // Repeat it and ensure we get the same result.
        // Should be a no-op.
        const rollback = orchestrator.restartAtNode("right-channel");
        assert(ok(rollback));
        deepStrictEqual(orchestrator.progress, "advanced");
        assertTasks(orchestrator.currentTasks(), [
          "left-channel",
          "right-channel",
        ]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "ready"],
          ["mixer", "inactive"],
        ]);
      }
      {
        // Now, try to restart at left-channel, which is already ready.
        // Should be a no-op.
        const rollback = orchestrator.restartAtNode("left-channel");
        assert(ok(rollback));
        deepStrictEqual(orchestrator.progress, "advanced");
        assertTasks(orchestrator.currentTasks(), [
          "left-channel",
          "right-channel",
        ]);
        assertState(diamond, orchestrator.state(), [
          ["input", "succeeded"],
          ["left-channel", "ready"],
          ["right-channel", "ready"],
          ["mixer", "inactive"],
        ]);
      }
      {
        // Let's go all the way to the beginning.
        const rollback = orchestrator.restartAtNode("input");
        assert(ok(rollback));
        deepStrictEqual(orchestrator.progress, "initial");
        assertTasks(orchestrator.currentTasks(), ["input"]);
        assertState(diamond, orchestrator.state(), [
          ["input", "ready"],
          ["left-channel", "inactive"],
          ["right-channel", "inactive"],
          ["mixer", "inactive"],
        ]);
      }
    });
  });
});
