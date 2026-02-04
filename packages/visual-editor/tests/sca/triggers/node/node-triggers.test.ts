/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import { Node as NodeTriggers } from "../../../../src/sca/triggers/triggers.js";
import { Node as NodeActions } from "../../../../src/sca/actions/actions.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { type AppServices } from "../../../../src/sca/services/services.js";
import { type AppActions } from "../../../../src/sca/actions/actions.js";
import { flushEffects } from "../utils.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { EditableGraph } from "@breadboard-ai/types";

/**
 * Creates a mock EditableGraph with the required methods.
 */
function createMockEditor(options?: {
  onApply?: (transform: unknown) => { success: boolean };
}): EditableGraph {
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
    apply: async (transform: unknown) => {
      return options?.onApply?.(transform) ?? { success: true };
    },
  } as unknown as EditableGraph;
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
    NodeTriggers.bind.clean();
    controller.editor.graph.setEditor(null);
    controller.editor.graph.lastNodeConfigChange = null;
    controller.editor.graph.readOnly = false;
  });

  suite("Thin Trigger Pattern", () => {
    test("Trigger does not call autonamer when lastNodeConfigChange is null", async () => {
      let autonameCalled = false;

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeTriggers.bind({ controller, services, actions: {} as AppActions });
      NodeActions.bind({ controller, services });

      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.lastNodeConfigChange = null;

      NodeTriggers.registerAutonameTrigger();
      await flushEffects();

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called when lastNodeConfigChange is null"
      );
    });

    test("Trigger calls autonamer when lastNodeConfigChange is set", async () => {
      let autonameCalled = false;

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeTriggers.bind({ controller, services, actions: {} as AppActions });
      NodeActions.bind({ controller, services });

      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = false;

      NodeTriggers.registerAutonameTrigger();
      await flushEffects();

      // Set config change to trigger
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: "test-node",
        graphId: "main",
        configuration: { prompt: "Hello world" },
        titleUserModified: false,
      };

      await flushEffects();

      assert.strictEqual(
        autonameCalled,
        true,
        "autonamer should be called when lastNodeConfigChange is set"
      );
    });

    test("Trigger does not call autonamer when readOnly is true", async () => {
      let autonameCalled = false;

      const services = {
        autonamer: {
          async autoname() {
            autonameCalled = true;
            return [{ parts: [{ json: { notEnoughContext: true } }] }];
          },
        },
      } as unknown as AppServices;

      NodeTriggers.bind({ controller, services, actions: {} as AppActions });
      NodeActions.bind({ controller, services });

      controller.editor.graph.setEditor(createMockEditor());
      controller.editor.graph.readOnly = true;

      NodeTriggers.registerAutonameTrigger();
      await flushEffects();

      // Set config change to trigger
      controller.editor.graph.lastNodeConfigChange = {
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      };

      await flushEffects();

      assert.strictEqual(
        autonameCalled,
        false,
        "autonamer should not be called when graph is readOnly"
      );
    });

    test("Trigger applies metadata on successful autoname", async () => {
      let appliedTransform: unknown = null;

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

      const mockEditor = createMockEditor({
        onApply: (transform) => {
          appliedTransform = transform;
          return { success: true };
        },
      });

      NodeTriggers.bind({ controller, services, actions: {} as AppActions });
      NodeActions.bind({ controller, services });

      controller.editor.graph.setEditor(mockEditor);
      controller.editor.graph.readOnly = false;

      NodeTriggers.registerAutonameTrigger();
      await flushEffects();

      controller.editor.graph.lastNodeConfigChange = {
        nodeId: "test-node",
        graphId: "",
        configuration: { prompt: "test" },
        titleUserModified: false,
      };

      await flushEffects();

      assert.ok(appliedTransform, "transform should be applied");
    });
  });
});
