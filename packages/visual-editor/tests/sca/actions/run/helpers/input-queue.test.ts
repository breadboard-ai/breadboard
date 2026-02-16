/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { makeTestController } from "../../../helpers/mock-controller.js";
import {
  handleInputRequested,
  provideInput,
  cleanupStoppedInput,
} from "../../../../../src/sca/actions/run/helpers/input-queue.js";
import type { Schema } from "@breadboard-ai/types";
import type { AppController } from "../../../../../src/sca/controller/controller.js";
import { ReactiveAppScreen } from "../../../../../src/ui/state/app-screen.js";

function makeRun(controller: AppController): AppController["run"] {
  return controller.run;
}

const SCHEMA: Schema = {
  type: "object",
  properties: { text: { type: "string" } },
};

suite("input-queue helpers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  // ---------------------------------------------------------------------------
  // handleInputRequested
  // ---------------------------------------------------------------------------
  suite("handleInputRequested", () => {
    test("adds node to pending queue", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      handleInputRequested("node-1", SCHEMA, run);

      assert.ok(
        run.main.inputSchemas.has("node-1"),
        "node-1 should be in inputSchemas"
      );
    });

    test("activates immediately when no input is active", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      handleInputRequested("node-1", SCHEMA, run);

      assert.deepStrictEqual(
        run.main.input,
        { id: "node-1", schema: SCHEMA },
        "input signal should be set"
      );
    });

    test("queues silently when an input is already active", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // First input becomes active.
      handleInputRequested("node-1", SCHEMA, run);

      const schema2: Schema = { type: "object" };
      handleInputRequested("node-2", schema2, run);

      // Active input is still node-1.
      assert.strictEqual(
        run.main.input?.id,
        "node-1",
        "active input should still be node-1"
      );
      // But node-2 is in the queue.
      assert.ok(
        run.main.inputSchemas.has("node-2"),
        "node-2 should be in queue"
      );
    });

    test("bumps screen and marks as input on activation", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Create a screen first so bumpScreen has something to bump.
      run.screen.setScreen(
        "node-1",
        new ReactiveAppScreen("node-1", undefined)
      );

      handleInputRequested("node-1", SCHEMA, run);

      const screen = run.screen.screens.get("node-1");
      assert.ok(screen, "screen should exist");
      assert.strictEqual(screen.type, "input", "screen type should be 'input'");
    });

    test("sets renderer node state to 'waiting'", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      handleInputRequested("node-1", SCHEMA, run);

      const nodeState = run.renderer.nodes.get("node-1");
      assert.ok(nodeState, "node state should exist");
      assert.strictEqual(
        nodeState.status,
        "waiting",
        "status should be 'waiting'"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // provideInput
  // ---------------------------------------------------------------------------
  suite("provideInput", () => {
    test("no-ops when no input is active", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Should not throw.
      provideInput({ text: "hello" }, run);

      assert.strictEqual(run.main.input, null, "input should still be null");
    });

    test("resolves input and removes from queue", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Simulate a console entry that can resolve input.
      let resolvedWith: unknown = null;
      run.main.setConsoleEntry("node-1", {
        resolveInput(values: unknown) {
          resolvedWith = values;
        },
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);

      const values = { text: "hello" };
      provideInput(values, run);

      assert.deepStrictEqual(resolvedWith, values, "input should be resolved");
      assert.ok(
        !run.main.inputSchemas.has("node-1"),
        "node-1 should be removed from pending"
      );
    });

    test("sets renderer node state to 'working' after resolve", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      run.main.setConsoleEntry("node-1", {
        resolveInput() {},
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      provideInput({ text: "x" }, run);

      const nodeState = run.renderer.nodes.get("node-1");
      assert.ok(nodeState, "node state should exist");
      assert.strictEqual(
        nodeState.status,
        "working",
        "status should be 'working' after input provided"
      );
    });

    test("advances to next queued input after resolve", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Set up two entries.
      run.main.setConsoleEntry("node-1", {
        resolveInput() {},
        activateInput() {},
      } as never);
      run.main.setConsoleEntry("node-2", {
        resolveInput() {},
        activateInput() {},
      } as never);

      const schema2: Schema = { type: "object" };

      handleInputRequested("node-1", SCHEMA, run);
      handleInputRequested("node-2", schema2, run);

      // Provide input for node-1; node-2 should become active.
      provideInput({ text: "x" }, run);

      assert.strictEqual(
        run.main.input?.id,
        "node-2",
        "active input should advance to node-2"
      );
    });

    test("clears input when queue is empty", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      run.main.setConsoleEntry("node-1", {
        resolveInput() {},
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      provideInput({ text: "x" }, run);

      assert.strictEqual(
        run.main.input,
        null,
        "input should be cleared when queue is empty"
      );
    });

    test("resets screen type to 'progress' after input provided", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      run.screen.setScreen(
        "node-1",
        new ReactiveAppScreen("node-1", undefined)
      );
      run.main.setConsoleEntry("node-1", {
        resolveInput() {},
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      provideInput({ text: "x" }, run);

      const screen = run.screen.screens.get("node-1");
      assert.ok(screen, "screen should exist");
      assert.strictEqual(
        screen.type,
        "progress",
        "screen type should be 'progress' after resolve"
      );
    });

    test("no-ops when console entry is missing for active input", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Set input directly (bypassing handleInputRequested which would add
      // a console entry), simulating a stale input whose entry was removed.
      run.main.setInput({ id: "node-1", schema: SCHEMA });

      // No console entry for node-1. Should log and return early.
      provideInput({ text: "hello" }, run);

      // Input should remain (we returned before clearing).
      assert.deepStrictEqual(
        run.main.input,
        { id: "node-1", schema: SCHEMA },
        "input should remain unchanged when console entry missing"
      );
    });

    test("clears input when next pending node has no stored schema", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // Set up node-1 with a console entry so provideInput can resolve it.
      run.main.setConsoleEntry("node-1", {
        resolveInput() {},
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);

      // Manually add a pending input WITH schema, then delete the schema,
      // simulating a corrupted queue where the schema was lost.
      run.main.addPendingInput("node-2", SCHEMA);
      (run.main.inputSchemas as Map<string, unknown>).delete("node-2");

      // Resolve node-1. advanceInputQueue finds node-2 as nextId but
      // nextSchema is undefined → should clearInput.
      provideInput({ text: "x" }, run);

      assert.strictEqual(
        run.main.input,
        null,
        "input should be cleared when next schema is missing"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // cleanupStoppedInput
  // ---------------------------------------------------------------------------
  suite("cleanupStoppedInput", () => {
    test("aborts input and removes from queue", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      let aborted = false;
      run.main.setConsoleEntry("node-1", {
        abortInput() {
          aborted = true;
        },
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);

      cleanupStoppedInput("node-1", run);

      assert.ok(aborted, "abortInput should have been called");
      assert.ok(
        !run.main.inputSchemas.has("node-1"),
        "node-1 should be removed from pending"
      );
    });

    test("deletes screen", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      run.screen.setScreen(
        "node-1",
        new ReactiveAppScreen("node-1", undefined)
      );
      run.main.setConsoleEntry("node-1", {
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      cleanupStoppedInput("node-1", run);

      assert.ok(!run.screen.screens.has("node-1"), "screen should be deleted");
    });

    test("advances queue if stopped node was active input", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      const schema2: Schema = { type: "object" };

      run.main.setConsoleEntry("node-1", {
        abortInput() {},
        activateInput() {},
      } as never);
      run.main.setConsoleEntry("node-2", {
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      handleInputRequested("node-2", schema2, run);

      // node-1 is active. Stop it.
      cleanupStoppedInput("node-1", run);

      assert.strictEqual(
        run.main.input?.id,
        "node-2",
        "active input should advance to node-2"
      );
    });

    test("does not advance queue if stopped node was NOT active", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      const schema2: Schema = { type: "object" };

      run.main.setConsoleEntry("node-1", {
        activateInput() {},
      } as never);
      run.main.setConsoleEntry("node-2", {
        abortInput() {},
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);
      handleInputRequested("node-2", schema2, run);

      // node-1 is active. Stop node-2 (queued, not active).
      cleanupStoppedInput("node-2", run);

      assert.strictEqual(
        run.main.input?.id,
        "node-1",
        "active input should remain node-1"
      );
    });

    test("handles entry without abortInput gracefully", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      run.main.setConsoleEntry("node-1", {
        activateInput() {},
      } as never);

      handleInputRequested("node-1", SCHEMA, run);

      // Should not throw even though entry lacks abortInput.
      cleanupStoppedInput("node-1", run);

      assert.ok(!run.main.inputSchemas.has("node-1"), "node should be removed");
    });

    test("handles missing console entry gracefully", () => {
      const { controller } = makeTestController();
      const run = makeRun(controller);

      // No console entry set. Should not throw.
      cleanupStoppedInput("nonexistent", run);
    });
  });
});
