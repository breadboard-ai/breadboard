/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import {
  registerAutonameTrigger,
  bind,
} from "../../../../src/sca/triggers/node/node-triggers.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { EditableGraph } from "@breadboard-ai/types";

/**
 * Creates a mock EditableGraph with the required methods.
 */
function createMockEditor(): EditableGraph {
  return {
    raw: () => ({
      nodes: [{ id: "test-node", type: "promptTemplate" }],
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    inspect: () => ({
      nodeById: (id: string) =>
        id === "test-node"
          ? { descriptor: { type: "promptTemplate" } }
          : undefined,
    }),
    apply: async () => ({ success: true }),
  } as unknown as EditableGraph;
}

/**
 * Waits for microtask effects to run.
 */
async function flushEffects() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

suite("Node Triggers", () => {
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
    bind.clean();
    controller.editor.graph.setEditor(null);
    controller.editor.graph.lastNodeConfigChange = null;
    controller.editor.graph.readOnly = false;
  });

  test("Autoname trigger does not fire when lastNodeConfigChange is null", async () => {
    let autonameCalled = false;
    const services = {
      autonamer: {
        async autoname() {
          autonameCalled = true;
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.lastNodeConfigChange = null;

    registerAutonameTrigger();
    await flushEffects();

    assert.strictEqual(
      autonameCalled,
      false,
      "autoname should not be called when lastNodeConfigChange is null"
    );
  });

  test("Autoname trigger does not fire when readOnly is true", async () => {
    let autonameCalled = false;
    const services = {
      autonamer: {
        async autoname() {
          autonameCalled = true;
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = true;
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    registerAutonameTrigger();
    await flushEffects();

    assert.strictEqual(
      autonameCalled,
      false,
      "autoname should not be called when graph is readOnly"
    );
  });

  test("Autoname trigger fires when conditions are met", async () => {
    let autonameCalled = false;
    let autonameArgs: unknown = null;

    const services = {
      autonamer: {
        async autoname(content: unknown) {
          autonameCalled = true;
          autonameArgs = content;
          // Return a "not enough context" result so we don't need to mock apply
          return [{ parts: [{ json: { notEnoughContext: true } }] }];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();

    // Initial flush - should not call autoname yet
    await flushEffects();
    autonameCalled = false;

    // Now set the config change to trigger the autoname
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "Hello world" },
      titleUserModified: false,
    };

    await flushEffects();

    assert.strictEqual(
      autonameCalled,
      true,
      "autoname should be called when conditions are met"
    );

    // Verify the arguments passed to autoname
    assert.ok(
      Array.isArray(autonameArgs),
      "autonameArgs should be an LLMContent array"
    );
  });

  test("Autoname trigger skips when outputTemplates disabled and title user-modified", async () => {
    let autonameCalled = false;

    // Mock flags to return outputTemplates: false
    const originalFlags = controller.global.flags.flags;
    controller.global.flags.flags = async () => ({
      ...defaultRuntimeFlags,
      outputTemplates: false,
    });

    const services = {
      autonamer: {
        async autoname() {
          autonameCalled = true;
          return [{ parts: [{ json: { notEnoughContext: true } }] }];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();
    autonameCalled = false;

    // Set config change with titleUserModified: true
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: true,
    };

    await flushEffects();

    assert.strictEqual(
      autonameCalled,
      false,
      "autoname should not be called when outputTemplates disabled and title was user-modified"
    );

    // Restore the original flags function
    controller.global.flags.flags = originalFlags;
  });
});
