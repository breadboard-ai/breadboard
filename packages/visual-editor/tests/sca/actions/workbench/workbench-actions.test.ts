/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as workbenchActions from "../../../../src/sca/actions/workbench/workbench-actions.js";
import {
  onWorkbenchEligibilityChange,
  WorkbenchEligibility,
  onWorkbenchActivation,
} from "../../../../src/sca/actions/workbench/triggers.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import type { GraphDescriptor } from "@breadboard-ai/types";

suite("Workbench Actions", () => {
  beforeEach(() => {
    coordination.reset();
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  suite("updateWorkbenchEligibility", () => {
    test("sets eligible to true when flag is on and graph is single-agent", async () => {
      let eligibleSet: boolean | undefined;

      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
            },
            workbench: {
              set eligible(val: boolean) {
                eligibleSet = val;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.updateWorkbenchEligibility();

      assert.strictEqual(eligibleSet, true, "Should be eligible");
    });

    test("sets eligible to false when flag is off", async () => {
      let eligibleSet: boolean | undefined;

      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: false,
      });
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
            },
            workbench: {
              set eligible(val: boolean) {
                eligibleSet = val;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.updateWorkbenchEligibility();

      assert.strictEqual(
        eligibleSet,
        false,
        "Should not be eligible when flag is off"
      );
    });

    test("sets eligible to false when graph is multi-node", async () => {
      let eligibleSet: boolean | undefined;

      const multiNodeGraph: GraphDescriptor = {
        title: "Multi Node",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
          { id: "input-node", type: "input" },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return multiNodeGraph;
              },
            },
            workbench: {
              set eligible(val: boolean) {
                eligibleSet = val;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.updateWorkbenchEligibility();

      assert.strictEqual(
        eligibleSet,
        false,
        "Should not be eligible when graph is multi-node"
      );
    });
  });

  suite("setWorkbenchView", () => {
    test("sets view correctly", async () => {
      let viewSet: "workbench" | "classic" | undefined;

      const env = createMockEnvironment(defaultRuntimeFlags);
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            workbench: {
              set view(val: "workbench" | "classic") {
                viewSet = val;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.setWorkbenchView("classic");

      assert.strictEqual(viewSet, "classic");
    });
  });

  suite("resizeColumns", () => {
    test("sets splits correctly", async () => {
      let splitsSet: [number, number, number] | undefined;

      const env = createMockEnvironment(defaultRuntimeFlags);
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            workbench: {
              set splits(val: [number, number, number]) {
                splitsSet = val;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.resizeColumns([1, 3, 1]);

      assert.deepEqual(splitsSet, [1, 3, 1]);
    });
  });

  suite("applyObjective", () => {
    test("updates agent node config$prompt with new objective text while preserving existing tools", async () => {
      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: {
              "generation-mode": "agent",
              config$prompt: {
                role: "user",
                parts: [
                  {
                    text: `Old objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`,
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment(defaultRuntimeFlags);
      await env.isHydrated;

      let appliedTransform:
        | { id: string; configuration: Record<string, unknown> }
        | undefined;
      let configChange: { configuration: Record<string, unknown> } | undefined;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
              editor: {
                apply: async (transform: unknown) => {
                  appliedTransform = transform as {
                    id: string;
                    configuration: Record<string, unknown>;
                  };
                },
              },
              set lastNodeConfigChange(val: unknown) {
                configChange = val as {
                  configuration: Record<string, unknown>;
                };
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.applyObjective("New objective.");

      assert.ok(appliedTransform, "Should have applied a transform");
      assert.strictEqual(appliedTransform.id, "agent-node");
      assert.deepEqual(appliedTransform.configuration.config$prompt, {
        role: "user",
        parts: [
          {
            text: `New objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`,
          },
        ],
      });
      assert.ok(configChange, "Should have set config change");
      assert.deepEqual(configChange.configuration.config$prompt, {
        role: "user",
        parts: [
          {
            text: `New objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`,
          },
        ],
      });
    });
  });

  suite("toggleTool", () => {
    test("enables a tool by appending its placeholder to the prompt", async () => {
      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: {
              "generation-mode": "agent",
              config$prompt: {
                role: "user",
                parts: [{ text: "Solve the objective." }],
              },
            },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment(defaultRuntimeFlags);
      await env.isHydrated;

      let appliedTransform:
        | { id: string; configuration: Record<string, unknown> }
        | undefined;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
              editor: {
                apply: async (transform: unknown) => {
                  appliedTransform = transform as {
                    id: string;
                    configuration: Record<string, unknown>;
                  };
                },
              },
              set lastNodeConfigChange(_val: unknown) {},
            },
          },
        } as never,
        env,
      });

      await workbenchActions.toggleTool("tool-1", "Tool 1", true);

      assert.ok(appliedTransform, "Should have applied a transform");
      assert.deepEqual(appliedTransform.configuration.config$prompt, {
        role: "user",
        parts: [
          {
            text: `Solve the objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`,
          },
        ],
      });
    });

    test("disables a tool by removing its placeholder from the prompt", async () => {
      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: {
              "generation-mode": "agent",
              config$prompt: {
                role: "user",
                parts: [
                  {
                    text: `Solve the objective.\n{{\"type\":\"tool\",\"path\":\"tool-1\",\"title\":\"Tool 1\"}}`,
                  },
                ],
              },
            },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment(defaultRuntimeFlags);
      await env.isHydrated;

      let appliedTransform:
        | { id: string; configuration: Record<string, unknown> }
        | undefined;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
              editor: {
                apply: async (transform: unknown) => {
                  appliedTransform = transform as {
                    id: string;
                    configuration: Record<string, unknown>;
                  };
                },
              },
              set lastNodeConfigChange(_val: unknown) {},
            },
          },
        } as never,
        env,
      });

      await workbenchActions.toggleTool("tool-1", "Tool 1", false);

      assert.ok(appliedTransform, "Should have applied a transform");
      assert.deepEqual(appliedTransform.configuration.config$prompt, {
        role: "user",
        parts: [{ text: "Solve the objective." }],
      });
    });
  });

  suite("selectAgentNodeOnActivation", () => {
    test("selects agent node when workbench becomes active", async () => {
      let selectedIds: string[] | undefined;

      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      workbenchActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
            },
            selection: {
              selectNodes: (ids: string[]) => {
                selectedIds = ids;
              },
            },
          },
        } as never,
        env,
      });

      await workbenchActions.selectAgentNodeOnActivation();

      assert.deepEqual(selectedIds, ["agent-node"]);
    });
  });
});

suite("Workbench Triggers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  suite("onWorkbenchEligibilityChange", () => {
    test("returns trigger condition value 1 when eligible", async () => {
      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      const bind = {
        controller: {
          editor: {
            graph: {
              get graph() {
                return singleAgentGraph;
              },
            },
          },
        } as unknown as AppController,
        services: {} as unknown as AppServices,
        env,
      };

      const trigger = onWorkbenchEligibilityChange(bind);

      assert.strictEqual(trigger.type, "signal");
      assert.strictEqual(trigger.name, "Workbench Eligibility Change");
      assert.strictEqual(trigger.condition(), WorkbenchEligibility.ELIGIBLE);
    });

    test("returns trigger condition value 2 when not eligible", async () => {
      const multiNodeGraph: GraphDescriptor = {
        title: "Multi Node",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
          { id: "input-node", type: "input" },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      const bind = {
        controller: {
          editor: {
            graph: {
              get graph() {
                return multiNodeGraph;
              },
            },
          },
        } as unknown as AppController,
        services: {} as unknown as AppServices,
        env,
      };

      const trigger = onWorkbenchEligibilityChange(bind);

      assert.strictEqual(trigger.condition(), WorkbenchEligibility.INELIGIBLE);
    });
  });

  suite("onWorkbenchActivation", () => {
    test("returns true only when transition to active occurs", async () => {
      const singleAgentGraph: GraphDescriptor = {
        title: "Single Agent",
        nodes: [
          {
            id: "agent-node",
            type: "embed://a2/generate.bgl.json#module:main",
            configuration: { "generation-mode": "agent" },
          },
        ],
        edges: [],
      };

      const env = createMockEnvironment({
        ...defaultRuntimeFlags,
        enableAgentWorkbench: true,
      });
      await env.isHydrated;

      const controller = {
        editor: {
          graph: {
            get graph() {
              return singleAgentGraph;
            },
          },
          workbench: {
            eligible: false,
            view: "classic",
          },
        },
      } as unknown as AppController;

      const bind = {
        controller,
        services: {} as unknown as AppServices,
        env,
      };

      const trigger = onWorkbenchActivation(bind);

      // Initially inactive -> returns false
      assert.strictEqual(trigger.condition(), false);

      // Change workbench state to active
      controller.editor.workbench.eligible = true;
      controller.editor.workbench.view = "workbench";

      // Should return true on active transition
      assert.strictEqual(trigger.condition(), true);

      // Next check remains active -> returns false (no change)
      assert.strictEqual(trigger.condition(), false);

      // Deactivate
      controller.editor.workbench.view = "classic";
      assert.strictEqual(trigger.condition(), false);

      // Reactivate -> returns true
      controller.editor.workbench.view = "workbench";
      assert.strictEqual(trigger.condition(), true);
    });
  });
});
