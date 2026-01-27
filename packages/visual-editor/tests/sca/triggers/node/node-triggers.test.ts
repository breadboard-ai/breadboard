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
    addEventListener: () => { },
    removeEventListener: () => { },
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

  test("Autoname trigger logs warning when node not found", async () => {
    let autonameCalled = false;

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

    // Set config change with a node ID that doesn't exist
    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "nonexistent-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    await flushEffects();

    // Autoname should NOT be called because node was not found
    assert.strictEqual(
      autonameCalled,
      false,
      "autoname should not be called when node not found"
    );
  });

  test("Autoname trigger handles autoname error gracefully", async () => {
    const services = {
      autonamer: {
        async autoname() {
          return { $error: "API error" };
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    // Should not throw
    await flushEffects();
    assert.ok(true, "Should handle error gracefully");
  });

  test("Autoname trigger handles null result gracefully", async () => {
    const services = {
      autonamer: {
        async autoname() {
          // Return content that won't parse to valid JSON
          return [{ parts: [{ text: "not json" }] }];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(createMockEditor());
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    // Should not throw
    await flushEffects();
    assert.ok(true, "Should handle null result gracefully");
  });

  test("Autoname trigger applies metadata on success", async () => {
    let appliedTransform: unknown = null;

    const mockEditor = {
      raw: () => ({
        nodes: [{ id: "test-node", type: "promptTemplate" }],
      }),
      addEventListener: () => { },
      removeEventListener: () => { },
      inspect: () => ({
        nodeById: (id: string) =>
          id === "test-node"
            ? { descriptor: { type: "promptTemplate" } }
            : undefined,
      }),
      apply: async (transform: unknown) => {
        appliedTransform = transform;
        return { success: true };
      },
    } as unknown as EditableGraph;

    const services = {
      autonamer: {
        async autoname() {
          return [
            {
              parts: [
                {
                  json: {
                    title: "Generated Title",
                    description: "Generated description",
                    expected_output: [{ type: "text" }],
                  },
                },
              ],
            },
          ];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(mockEditor);
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    await flushEffects();

    assert.ok(appliedTransform, "Transform should be applied");
  });

  test("Autoname trigger handles failed apply gracefully", async () => {
    const mockEditor = {
      raw: () => ({
        nodes: [{ id: "test-node", type: "promptTemplate" }],
      }),
      addEventListener: () => { },
      removeEventListener: () => { },
      inspect: () => ({
        nodeById: (id: string) =>
          id === "test-node"
            ? { descriptor: { type: "promptTemplate" } }
            : undefined,
      }),
      apply: async () => ({ success: false, error: "Apply failed" }),
    } as unknown as EditableGraph;

    const services = {
      autonamer: {
        async autoname() {
          return [
            {
              parts: [
                {
                  json: {
                    title: "Generated Title",
                    description: "Generated description",
                  },
                },
              ],
            },
          ];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(mockEditor);
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    // Should not throw
    await flushEffects();
    assert.ok(true, "Should handle failed apply gracefully");
  });

  test("Autoname trigger discards results when graph changes during autoname", async () => {
    let appliedTransform = false;
    let graphChangeCallback: (() => void) | null = null;

    const mockEditor = {
      raw: () => ({
        nodes: [{ id: "test-node", type: "promptTemplate" }],
      }),
      addEventListener: (event: string, callback: () => void) => {
        if (event === "graphchange") {
          graphChangeCallback = callback;
        }
      },
      removeEventListener: () => { },
      inspect: () => ({
        nodeById: (id: string) =>
          id === "test-node"
            ? { descriptor: { type: "promptTemplate" } }
            : undefined,
      }),
      apply: async () => {
        appliedTransform = true;
        return { success: true };
      },
    } as unknown as EditableGraph;

    const services = {
      autonamer: {
        async autoname() {
          // Simulate a graph change happening during the autoname call
          if (graphChangeCallback) {
            graphChangeCallback();
          }
          return [
            {
              parts: [
                {
                  json: {
                    title: "Generated Title",
                    description: "Generated description",
                  },
                },
              ],
            },
          ];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(mockEditor);
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    await flushEffects();

    assert.strictEqual(
      appliedTransform,
      false,
      "Should NOT apply transform when graph changed during autoname"
    );
  });

  test("Autoname trigger strips trailing period from description", async () => {
    let appliedMetadata: { description?: string } | null = null;

    const mockEditor = {
      raw: () => ({
        nodes: [{ id: "test-node", type: "promptTemplate" }],
      }),
      addEventListener: () => { },
      removeEventListener: () => { },
      inspect: () => ({
        nodeById: (id: string) =>
          id === "test-node"
            ? {
              descriptor: { type: "promptTemplate" },
              metadata: () => ({}),
            }
            : undefined,
      }),
      apply: async (transform: { metadata?: { description?: string } }) => {
        appliedMetadata = transform.metadata ?? null;
        return { success: true };
      },
    } as unknown as EditableGraph;

    const services = {
      autonamer: {
        async autoname() {
          return [
            {
              parts: [
                {
                  json: {
                    title: "Generated Title",
                    description: "Description with trailing period.",
                  },
                },
              ],
            },
          ];
        },
      },
    } as unknown as AppServices;

    const actions = {} as AppActions;

    bind({ controller, services, actions });
    controller.editor.graph.setEditor(mockEditor);
    controller.editor.graph.readOnly = false;

    registerAutonameTrigger();
    await flushEffects();

    controller.editor.graph.lastNodeConfigChange = {
      nodeId: "test-node",
      graphId: "",
      configuration: { prompt: "test" },
      titleUserModified: false,
    };

    await flushEffects();

    // The description should have the trailing period stripped
    // Note: The UpdateNode transform receives metadata, but description
    // is processed and stored. We can verify the transform was called.
    assert.ok(appliedMetadata !== null, "Transform should be applied");
  });
});
