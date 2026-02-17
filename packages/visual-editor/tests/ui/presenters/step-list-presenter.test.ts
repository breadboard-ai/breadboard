/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, describe, test } from "node:test";
import { StepListPresenter } from "../../../src/ui/presenters/step-list-presenter.js";
import {
  makeTestController,
  makeTestServices,
  flushEffects,
} from "../../sca/helpers/index.js";
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
    addOutput() {},
    requestInput() {
      return Promise.reject(new Error("Input not supported in test"));
    },
    activateInput() {},
    resolveInput() {},
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
    assert.strictEqual(
      presenter.steps.size,
      0,
      "should start with empty steps"
    );
  });

  test("connect starts watching SCA state", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    presenter.connect(sca);
    await flushEffects();

    // The presenter is now connected - steps derived from console
    assert.strictEqual(
      presenter.steps.size,
      0,
      "should have no steps when console is empty"
    );

    presenter.disconnect();
  });

  test("disconnect stops watching and clears steps", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    presenter.connect(sca);
    await flushEffects();

    presenter.disconnect();

    assert.strictEqual(
      presenter.steps.size,
      0,
      "should clear steps on disconnect"
    );
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

  test("maps 'waiting' status to 'working'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Waiting",
      status: { status: "waiting" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-wait", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-wait")?.status, "working");
    presenter.disconnect();
  });

  test("maps 'working' status to 'working'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Working",
      status: { status: "working" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-work", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-work")?.status, "working");
    presenter.disconnect();
  });

  test("maps 'succeeded' status to 'complete'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Succeeded",
      status: { status: "succeeded" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-ok", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-ok")?.status, "complete");
    presenter.disconnect();
  });

  test("maps 'inactive' status to 'ready'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Inactive",
      status: { status: "inactive" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-inact", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-inact")?.status, "ready");
    presenter.disconnect();
  });

  test("maps 'ready' status to 'ready'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Ready",
      status: { status: "ready" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-ready", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-ready")?.status, "ready");
    presenter.disconnect();
  });

  test("maps 'failed' status to 'complete'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Failed",
      status: { status: "failed" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-fail", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-fail")?.status, "complete");
    presenter.disconnect();
  });

  test("maps 'skipped' status to 'complete'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Skipped",
      status: { status: "skipped" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-skip", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-skip")?.status, "complete");
    presenter.disconnect();
  });

  test("maps 'interrupted' status to 'complete'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Interrupted",
      status: { status: "interrupted" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-int", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("node-int")?.status, "complete");
    presenter.disconnect();
  });

  test("flowgen generating status overrides to 'working'", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    // Set flowgen to generating
    (
      sca.controller.global.flowgenInput as { state: { status: string } }
    ).state.status = "generating";

    const entry = mockConsoleEntry({
      title: "Node",
      status: { status: "inactive" } as unknown as NodeRunState,
    });
    sca.controller.run.main.setConsoleEntry("node-fg", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("node-fg")?.status,
      "working",
      "generating status should override to 'working'"
    );
    presenter.disconnect();
  });

  test("input entry extracts prompt from output values", async () => {
    const sca = makeMockSCA();
    const presenter = new StepListPresenter();

    const outputMap = new Map([
      ["key", { parts: [{ text: "What is your name?" }] }],
    ]);

    const entry = mockConsoleEntry({
      title: "User Input",
      tags: ["input"],
      output: outputMap as never,
    });
    sca.controller.run.main.setConsoleEntry("input-prompt", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("input-prompt")?.prompt,
      "What is your name?"
    );
    presenter.disconnect();
  });

  test("non-input entry gets prompt from graph node step_intent", async () => {
    const sca = makeMockSCA();
    // Set up a graph with a node that has step_intent metadata
    const graph = {
      nodes: [
        {
          id: "gen-node",
          type: "generate",
          metadata: { step_intent: "Summarize the document" },
        },
      ],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Generate",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("gen-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("gen-node")?.prompt,
      "Summarize the document"
    );
    presenter.disconnect();
  });

  test("non-input entry falls back to config$prompt for prompt", async () => {
    const sca = makeMockSCA();
    const graph = {
      nodes: [
        {
          id: "gen-node",
          type: "generate",
          configuration: {
            config$prompt: [{ parts: [{ text: "Config prompt text" }] }],
          },
        },
      ],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Generate",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("gen-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("gen-node")?.prompt,
      "Config prompt text"
    );
    presenter.disconnect();
  });

  test("non-input entry falls back to text field for prompt", async () => {
    const sca = makeMockSCA();
    const graph = {
      nodes: [
        {
          id: "gen-node",
          type: "generate",
          configuration: {
            text: "Plain text prompt",
          },
        },
      ],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Generate",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("gen-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("gen-node")?.prompt,
      "Plain text prompt"
    );
    presenter.disconnect();
  });

  test("input entry gets label from graph node title config", async () => {
    const sca = makeMockSCA();
    const graph = {
      nodes: [
        {
          id: "input-node",
          type: "input",
          configuration: {
            title: "Customer Name",
          },
        },
      ],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Input",
      tags: ["input"],
    });
    sca.controller.run.main.setConsoleEntry("input-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("input-node")?.label,
      "Customer Name"
    );
    presenter.disconnect();
  });

  test("input entry falls back to description for label", async () => {
    const sca = makeMockSCA();
    const graph = {
      nodes: [
        {
          id: "input-node",
          type: "input",
          configuration: {
            description: "Enter your email",
          },
        },
      ],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Input",
      tags: ["input"],
    });
    sca.controller.run.main.setConsoleEntry("input-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(
      presenter.steps.get("input-node")?.label,
      "Enter your email"
    );
    presenter.disconnect();
  });

  test("returns empty prompt when graph has no matching node", async () => {
    const sca = makeMockSCA();
    const graph = { nodes: [] };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Unknown",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("missing-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("missing-node")?.prompt, "");
    presenter.disconnect();
  });

  test("returns empty prompt when node has no configuration", async () => {
    const sca = makeMockSCA();
    const graph = {
      nodes: [{ id: "bare-node", type: "test" }],
    };
    (sca.controller.editor.graph as { editor: { raw: () => unknown } }).editor =
      {
        raw: () => graph,
      };

    const presenter = new StepListPresenter();

    const entry = mockConsoleEntry({
      title: "Bare",
      tags: ["generate"],
    });
    sca.controller.run.main.setConsoleEntry("bare-node", entry);

    presenter.connect(sca);
    await flushEffects();

    assert.strictEqual(presenter.steps.get("bare-node")?.prompt, "");
    presenter.disconnect();
  });
});
