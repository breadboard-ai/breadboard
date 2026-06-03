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
        nodes: [{ id: "agent-node", type: "agent" }],
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
        nodes: [{ id: "agent-node", type: "agent" }],
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
          { id: "agent-node", type: "agent" },
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
        nodes: [{ id: "agent-node", type: "agent" }],
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
          { id: "agent-node", type: "agent" },
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
});
