/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { AppScreenPresenter } from "../../../src/ui/presenters/app-screen-presenter.js";
import { createAppScreen } from "../../../src/sca/utils/app-screen.js";
import { ScreenController } from "../../../src/sca/controller/subcontrollers/run/screen-controller.js";
import { RunController } from "../../../src/sca/controller/subcontrollers/run/run-controller.js";
import { RendererController } from "../../../src/sca/controller/subcontrollers/run/renderer-controller.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import type { SCA } from "../../../src/sca/sca.js";
import type { AppController } from "../../../src/sca/controller/controller.js";

/**
 * Creates a minimal mock SCA for AppScreenPresenter testing.
 * Only provides the controllers the presenter actually reads.
 */
function makeMockSCA(options?: {
  error?: { message: string };
  hasInput?: boolean;
  finalOutputValues?: Record<string, unknown>;
}): { sca: SCA; screen: ScreenController; run: RunController } {
  const run = new RunController("test-run", "test");
  const screen = new ScreenController("test-screen", "test");
  const renderer = new RendererController("test-renderer", "test");

  if (options?.error) {
    run.setError(options.error);
  }
  if (options?.hasInput) {
    run.setInput({ id: "input-node", schema: {} });
  }

  const controller = {
    run: { main: run, screen, renderer },
    editor: {
      graph: {
        finalOutputValues: options?.finalOutputValues,
      },
    },
  } as unknown as AppController;

  const sca = { controller } as unknown as SCA;

  return { sca, screen, run };
}

/**
 * Wait for effects to propagate.
 */
async function flush() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

suite("AppScreenPresenter state derivation", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("defaults to splash state", async () => {
    const { sca } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);
    await flush();

    assert.strictEqual(presenter.state, "splash");
    assert.strictEqual(presenter.current.size, 0);
    assert.strictEqual(presenter.last, null);

    presenter.disconnect();
  });

  test("state is splash when no screens exist", async () => {
    const { sca } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);
    await flush();

    assert.strictEqual(presenter.state, "splash");

    presenter.disconnect();
  });

  test("state is output when finalOutputValues is pre-loaded (shared results link)", async () => {
    const { sca } = makeMockSCA({
      finalOutputValues: { result: "test" },
    });

    const presenter = new AppScreenPresenter();
    presenter.connect(sca);
    await flush();

    assert.strictEqual(presenter.state, "output");
    assert.notStrictEqual(presenter.finalOutput, null);

    presenter.disconnect();
  });

  test("state is progress when screens are active", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    const appScreen = createAppScreen("Test", undefined);
    screen.setScreen("node-1", appScreen);
    await flush();

    assert.strictEqual(presenter.state, "progress");
    assert.strictEqual(presenter.current.size, 1);
    assert.notStrictEqual(presenter.last, null);

    presenter.disconnect();
  });

  test("state is output when all screens are complete", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    screen.setScreen("node-1", createAppScreen("Test", undefined));
    // After setScreen, use the wrapped reference from the controller.
    screen.screens.get("node-1")!.finalize({
      outputs: {},
      index: "0",
      node: { id: "node-1", type: "test" },
      inputs: {},
      timestamp: 0,
      newOpportunities: [],
    });
    await flush();

    assert.strictEqual(presenter.state, "output");
    assert.strictEqual(presenter.current.size, 0);

    presenter.disconnect();
  });

  test("state is error when run has error", async () => {
    const { sca, screen } = makeMockSCA({
      error: { message: "Something broke" },
    });
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    // Need at least one screen for `last` to be non-null
    screen.setScreen("node-1", createAppScreen("Test", undefined));
    await flush();

    assert.strictEqual(presenter.state, "error");

    presenter.disconnect();
  });

  test("state is input when run has pending input", async () => {
    const { sca, screen } = makeMockSCA({ hasInput: true });
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    screen.setScreen("node-1", createAppScreen("Test", undefined));
    await flush();

    assert.strictEqual(presenter.state, "input");

    presenter.disconnect();
  });
});

suite("AppScreenPresenter current and last", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("current excludes completed screens", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    const screen1 = createAppScreen("A", undefined);
    const screen2 = createAppScreen("B", undefined);
    screen.setScreen("node-1", screen1);
    screen.setScreen("node-2", screen2);

    // After setScreen, must use the wrapped reference from the controller.
    screen.screens.get("node-1")!.finalize({
      outputs: {},
      index: "0",
      node: { id: "node-1", type: "test" },
      inputs: {},
      timestamp: 0,
      newOpportunities: [],
    });
    await flush();

    assert.strictEqual(presenter.current.size, 1);
    assert.ok(presenter.current.has("node-2"));
    assert.ok(!presenter.current.has("node-1"));

    presenter.disconnect();
  });

  test("last returns most recent non-input-complete screen", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    const screen1 = createAppScreen("A", undefined);
    const screen2 = createAppScreen("B", undefined);
    screen.setScreen("node-1", screen1);
    screen.setScreen("node-2", screen2);
    await flush();

    // setScreen wraps the POJO into a SignalObject, so compare against
    // the wrapped reference from the controller, not the original POJO.
    assert.strictEqual(presenter.last, screen.screens.get("node-2"));

    presenter.disconnect();
  });

  test("disconnect resets all state", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    screen.setScreen("node-1", createAppScreen("Test", undefined));
    await flush();

    presenter.disconnect();

    assert.strictEqual(presenter.state, "splash");
    assert.strictEqual(presenter.current.size, 0);
    assert.strictEqual(presenter.last, null);
  });

  test("state is interactive when a screen has a2ui and interactive status", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();
    presenter.connect(sca);

    screen.setScreen("node-1", createAppScreen("Interactive Test", undefined));

    // Mutate the wrapped screen to simulate an interactive state
    const wrappedScreen = screen.screens.get("node-1")!;
    wrappedScreen.status = "interactive";
    wrappedScreen.last = {
      output: {},
      schema: undefined,
      a2ui: { type: "test" },
    } as never;
    await flush();

    assert.strictEqual(presenter.state, "interactive");

    presenter.disconnect();
  });

  test("connect is idempotent", async () => {
    const { sca, screen } = makeMockSCA();
    const presenter = new AppScreenPresenter();

    presenter.connect(sca);
    await flush();

    // Calling connect again should not create duplicate effects
    presenter.connect(sca);
    screen.setScreen("node-1", createAppScreen("Test", undefined));
    await flush();

    assert.strictEqual(presenter.current.size, 1);

    presenter.disconnect();
    assert.strictEqual(presenter.state, "splash");
  });
});
