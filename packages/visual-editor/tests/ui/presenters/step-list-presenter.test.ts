/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { StepListPresenter } from "../../../src/ui/presenters/step-list-presenter.js";
import { makeTestController, makeTestServices, flushEffects } from "../../sca/triggers/utils.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import type { SCA } from "../../../src/sca/sca.js";
import type { ConsoleEntry, NodeRunState } from "@breadboard-ai/types";

/**
 * Creates a minimal mock SCA for testing the presenter.
 */
function makeMockSCA() {
  const { controller } = makeTestController();
  const { services } = makeTestServices();

  return {
    controller,
    services,
  } as unknown as SCA;
}

/**
 * Creates a mock console entry for testing.
 */
function mockConsoleEntry(overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    title: "Test Node",
    icon: "test-icon",
    tags: [],
    open: false,
    rerun: false,
    work: new Map(),
    output: new Map(),
    error: null,
    completed: false,
    current: null,
    ...overrides,
  };
}

describe("StepListPresenter", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("initializes with empty steps", () => {
    const presenter = new StepListPresenter();
    assert.strictEqual(presenter.steps.size, 0, "should start with empty steps");
  });

  test("connect starts watching SCA state", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    presenter.connect(sca);
    await flushEffects();

    // The presenter is now connected - steps derived from console
    assert.strictEqual(presenter.steps.size, 0, "should have no steps when console is empty");

    presenter.disconnect();
  });

  test("disconnect stops watching and clears steps", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    presenter.connect(sca);
    await flushEffects();

    presenter.disconnect();

    assert.strictEqual(presenter.steps.size, 0, "should clear steps on disconnect");
  });

  test("derives steps from console entries", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    // Add a console entry to the run controller
    const entry = mockConsoleEntry({
      title: "Generate Text",
      icon: "sparkle",
      tags: ["generate"],
      status: { status: "done" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-1", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.size, 1, "should have one step");
    const step = presenter.steps.get("node-1");
    assert.ok(step, "step should exist");
    assert.strictEqual(step.title, "Generate Text");
    assert.strictEqual(step.icon, "sparkle");
    assert.strictEqual(step.status, "complete"); // "done" -> "complete"

    presenter.disconnect();
  });

  test("maps node status to step status correctly", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    // Test "running" -> "working"
    const runningEntry = mockConsoleEntry({
      title: "Running Node",
      status: { status: "running" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-running", runningEntry);

    // Test "done" -> "complete"
    const doneEntry = mockConsoleEntry({
      title: "Done Node",
      status: { status: "done" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-done", doneEntry);

    // Test undefined status -> "pending"
    const pendingEntry = mockConsoleEntry({
      title: "Pending Node",
    });
    sca.controller.run.main.setConsoleEntry("node-pending", pendingEntry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-running")?.status, "working");
    assert.strictEqual(presenter.steps.get("node-done")?.status, "complete");
    assert.strictEqual(presenter.steps.get("node-pending")?.status, "pending");

    presenter.disconnect();
  });

  test("input steps have 'Question from user' as default label", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const inputEntry = mockConsoleEntry({
      title: "User Input",
      tags: ["input"],
    });
    sca.controller.run.main.setConsoleEntry("input-node", inputEntry);

    presenter.connect(sca);
    await flushEffects();

    const step = presenter.steps.get("input-node");
    assert.ok(step, "step should exist");
    assert.strictEqual(step.label, "Question from user");

    presenter.disconnect();
  });

  test("non-input steps have 'Prompt' as label", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const generateEntry = mockConsoleEntry({
      title: "Generate",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("generate-node", generateEntry);

    presenter.connect(sca);
    await flushEffects();

    const step = presenter.steps.get("generate-node");
    assert.ok(step, "step should exist");
    assert.strictEqual(step.label, "Prompt");

    presenter.disconnect();
  });

  test("connect is idempotent", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    presenter.connect(sca);
    await flushEffects();

    // Calling connect again should not throw or create duplicate effects
    presenter.connect(sca);
    await flushEffects();

    presenter.disconnect();
    // Should only need one disconnect
    assert.strictEqual(presenter.steps.size, 0);
  });
});
