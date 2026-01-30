/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import {
  registerPageTitleTrigger,
  bind,
} from "../../../../src/sca/triggers/shell/shell-triggers.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { flushEffects } from "../utils.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { EditableGraph, GraphChangeEvent } from "@breadboard-ai/types";

type GraphChangeHandler = (event: GraphChangeEvent) => void;

/**
 * Creates a mock editor with a settable title for testing.
 * The title can be changed by calling fireGraphChange() with a new title.
 */
function createMockEditorWithTitle(initialTitle: string | null = null) {
  const graph = { title: initialTitle };
  const listeners: { graphchange: GraphChangeHandler[] } = { graphchange: [] };

  return {
    raw: () => graph,
    addEventListener: (event: string, handler: GraphChangeHandler) => {
      if (event === "graphchange") {
        listeners.graphchange.push(handler);
      }
    },
    removeEventListener: () => { },
    /**
     * Simulates a graph change event, updating the title reactively.
     */
    fireGraphChange: (newTitle: string | null) => {
      graph.title = newTitle;
      const evt = { graph } as GraphChangeEvent;
      for (const handler of listeners.graphchange) {
        handler(evt);
      }
    },
  } as unknown as EditableGraph & {
    fireGraphChange: (newTitle: string | null) => void;
  };
}

suite("Shell Triggers - Page Title", () => {
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
  });

  test("Sets document title when graph has a title", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up the graph controller with a mock editor that has a title.
    const mockEditor = createMockEditorWithTitle("My Test Board");
    controller.editor.graph.setEditor(mockEditor);

    // Register the trigger - this will run the effect.
    registerPageTitleTrigger();
    await flushEffects();

    assert.ok(
      document.title.includes("My Test Board"),
      `Document title should contain 'My Test Board', got: "${document.title}"`
    );
  });

  test("Reacts to title changes (reactivity test)", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up with initial title.
    const mockEditor = createMockEditorWithTitle("Initial Title");
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    assert.ok(
      document.title.includes("Initial Title"),
      `Document title should contain 'Initial Title', got: "${document.title}"`
    );

    // Fire a graph change event with a new title - this triggers the signal update.
    mockEditor.fireGraphChange("Updated Title");
    await flushEffects();

    assert.ok(
      document.title.includes("Updated Title"),
      `Document title should contain 'Updated Title' after reactive change, got: "${document.title}"`
    );
  });

  test("Uses default title when graph title is null", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up with null title.
    const mockEditor = createMockEditorWithTitle(null);
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    // Should just be the suffix without a board name
    assert.ok(
      !document.title.includes(" - ") || document.title.startsWith("APP_NAME"),
      `Document title should be default suffix, got: "${document.title}"`
    );
  });

  test("Uses default title when graph title is empty", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up with empty string title.
    const mockEditor = createMockEditorWithTitle("");
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    // Empty string is falsy, so should use default
    assert.ok(
      !document.title.startsWith(" - "),
      `Document title should not start with ' - ', got: "${document.title}"`
    );
  });

  test("Trims whitespace from title", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    // Set up with padded title.
    const mockEditor = createMockEditorWithTitle("  Padded Title  ");
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    assert.ok(
      document.title.includes("Padded Title") &&
      !document.title.includes("  Padded"),
      `Document title should trim whitespace, got: "${document.title}"`
    );
  });

  test("Handles special characters in title", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    const mockEditor = createMockEditorWithTitle("Test <script> & \"quotes\"");
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    assert.ok(
      document.title.includes("Test <script> & \"quotes\""),
      `Document title should preserve special characters, got: "${document.title}"`
    );
  });

  test("Handles emoji and Unicode in title", async () => {
    const actions = {} as AppActions;
    const services = {} as AppServices;

    bind({ controller, services, actions });

    const mockEditor = createMockEditorWithTitle("My Board 🚀✨");
    controller.editor.graph.setEditor(mockEditor);

    registerPageTitleTrigger();
    await flushEffects();

    assert.ok(
      document.title.includes("My Board 🚀✨"),
      `Document title should preserve emoji, got: "${document.title}"`
    );
  });
});
