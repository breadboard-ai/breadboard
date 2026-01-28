/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, mock, suite, test } from "node:test";
import {
  registerSaveTrigger,
  registerNewerVersionTrigger,
  bind,
} from "../../../../src/sca/triggers/board/board-triggers.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { createMockEditor, flushEffects } from "../utils.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";



suite("Board Triggers", () => {
  // Get the singleton controller once for all tests
  let controller: ReturnType<typeof appController>;

  before(async () => {
    setDOM();
    controller = appController(defaultRuntimeFlags);
    await controller.isHydrated;
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    // Clean up any registered triggers between tests.
    bind.clean();

    // Reset the graph controller state between tests.
    controller.editor.graph.setEditor(null);
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = 0;
  });

  test("Save trigger fires when version changes on a writable graph", async () => {
    // Track whether save was called
    let saveCalled = false;
    const actions = {
      board: {
        bind: {},
        async save() {
          saveCalled = true;
        },
      },
    } as AppActions;

    const services = {} as AppServices;

    // Bind the trigger dependencies.
    bind({ controller, services, actions });

    // Set up the graph controller with a mock editor.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = 0;

    // Register the trigger - this creates the effect.
    registerSaveTrigger();

    // Reset the flag after initial effect run.
    await flushEffects();
    saveCalled = false;

    // Trigger a version change by incrementing the version.
    controller.editor.graph.version = 1;

    // Wait for the microtask effect to run.
    await flushEffects();

    assert.strictEqual(saveCalled, true, "save() should have been called");
  });

  test("Save trigger does not fire when graph is readOnly", async () => {
    let saveCalled = false;
    const actions = {
      board: {
        bind: {},
        async save() {
          saveCalled = true;
        },
      },
    } as AppActions;

    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up the graph controller with a mock editor but readOnly.
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = true;
    controller.editor.graph.version = 0;

    // Register the trigger and flush initial effect.
    registerSaveTrigger();
    await flushEffects();
    saveCalled = false;

    // Trigger a version change.
    controller.editor.graph.version = 2;
    await flushEffects();

    assert.strictEqual(
      saveCalled,
      false,
      "save() should not have been called for readOnly graph"
    );
  });

  test("Save trigger does not fire when version is -1", async () => {
    let saveCalled = false;
    const actions = {
      board: {
        bind: {},
        async save() {
          saveCalled = true;
        },
      },
    } as AppActions;

    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up the graph controller with version -1 (uninitialized).
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = -1;

    registerSaveTrigger();
    await flushEffects();

    assert.strictEqual(
      saveCalled,
      false,
      "save() should not have been called when version is -1"
    );
  });

  test("Save trigger does not fire when there is no editor", async () => {
    let saveCalled = false;
    const actions = {
      board: {
        bind: {},
        async save() {
          saveCalled = true;
        },
      },
    } as AppActions;

    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Don't set an editor (explicitly set to null).
    controller.editor.graph.setEditor(null);
    controller.editor.graph.readOnly = false;
    controller.editor.graph.version = 1;

    registerSaveTrigger();
    await flushEffects();

    assert.strictEqual(
      saveCalled,
      false,
      "save() should not have been called when there is no editor"
    );
  });

  test("Newer version trigger shows snackbar when newerVersionAvailable is true", async () => {
    // Use mock.method to mock the snackbar method
    const snackbarMock = mock.method(
      controller.global.snackbars,
      "snackbar",
      () => "mock-id"
    );

    try {
      const actions = { board: { bind: {}, save: async () => { } } } as AppActions;
      const services = {} as AppServices;

      bind({ controller, services, actions });

      // Set up initial state: no newer version
      controller.board.main.newerVersionAvailable = false;

      registerNewerVersionTrigger();
      await flushEffects();
      snackbarMock.mock.resetCalls();

      // Trigger: set newer version available
      controller.board.main.newerVersionAvailable = true;
      await flushEffects();

      assert.strictEqual(snackbarMock.mock.callCount(), 1, "snackbar() should have been called");
      const callArgs = snackbarMock.mock.calls[0].arguments;
      assert.ok((callArgs[0] as string).includes("newer version"), "Should mention newer version");
      // Flag should be reset
      assert.strictEqual(controller.board.main.newerVersionAvailable, false);
    } finally {
      snackbarMock.mock.restore();
    }
  });

  test("Newer version trigger does not fire when newerVersionAvailable is false", async () => {
    const snackbarMock = mock.method(
      controller.global.snackbars,
      "snackbar",
      () => "mock-id"
    );

    try {
      const actions = { board: { bind: {}, save: async () => { } } } as AppActions;
      const services = {} as AppServices;

      bind({ controller, services, actions });

      // Set up initial state: no newer version
      controller.board.main.newerVersionAvailable = false;

      registerNewerVersionTrigger();
      await flushEffects();

      assert.strictEqual(
        snackbarMock.mock.callCount(),
        0,
        "snackbar() should not have been called when newerVersionAvailable is false"
      );
    } finally {
      snackbarMock.mock.restore();
    }
  });
});
