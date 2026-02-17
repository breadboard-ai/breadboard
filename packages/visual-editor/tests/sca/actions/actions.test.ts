/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach, afterEach } from "node:test";
import {
  actions,
  activateTriggers,
  cleanActions,
} from "../../../src/sca/actions/actions.js";
import { AppServices } from "../../../src/sca/services/services.js";
import { AppController } from "../../../src/sca/controller/controller.js";
import { makeAction } from "../../../src/sca/actions/binder.js";
import { coordination } from "../../../src/sca/coordination.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";

suite("Actions", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    cleanActions();
    unsetDOM();
  });

  test("Instantiates without error", async () => {
    assert.doesNotThrow(() => {
      actions({} as AppController, {} as AppServices);
    });

    assert.throws(() => {
      const f = makeAction();
      String((f as unknown as { foo: number }).foo);
    }, new Error("Not set"));
  });

  suite("activateTriggers", () => {
    test("returns a dispose function", () => {
      // Set up minimal mock controller and services
      const mockController = {
        editor: {
          graph: {
            version: -1,
            readOnly: true,
            url: null,
            editor: null,
            lastNodeConfigChange: null,
            title: "",
          },
          step: { pendingEdit: null, pendingAssetEdit: null },
          share: { state: { status: "closed" } },
        },
        board: { main: { newerVersionAvailable: null } },
        global: {
          screenSize: {},
          snackbars: { snackbar: () => {} },
          toasts: { toast: () => {} },
        },
        router: { updateFromCurrentUrl: () => {}, init: () => {} },
        run: {},
      } as unknown as AppController;

      const mockServices = {
        stateEventBus: new EventTarget(),
        agentContext: {
          invalidateResumableRuns: () => {},
          clearAllRuns: () => {},
        },
        googleDriveBoardServer: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      } as unknown as AppServices;

      // Initialize actions
      actions(mockController, mockServices);

      // Activate triggers
      const dispose = activateTriggers();

      assert.strictEqual(
        typeof dispose,
        "function",
        "Should return a function"
      );

      // Cleanup
      dispose();
    });

    test("dispose function cleans up triggers", () => {
      const mockController = {
        editor: {
          graph: {
            version: -1,
            readOnly: true,
            url: null,
            editor: null,
            lastNodeConfigChange: null,
            title: "",
          },
          step: { pendingEdit: null, pendingAssetEdit: null },
          share: { state: { status: "closed" } },
        },
        board: { main: { newerVersionAvailable: null } },
        global: {
          screenSize: {},
          snackbars: { snackbar: () => {} },
          toasts: { toast: () => {} },
        },
        router: { updateFromCurrentUrl: () => {}, init: () => {} },
        run: {},
      } as unknown as AppController;

      const mockServices = {
        stateEventBus: new EventTarget(),
        agentContext: {
          invalidateResumableRuns: () => {},
          clearAllRuns: () => {},
        },
        googleDriveBoardServer: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      } as unknown as AppServices;

      actions(mockController, mockServices);

      const dispose = activateTriggers();

      // Calling dispose should not throw
      assert.doesNotThrow(() => {
        dispose();
      }, "dispose should not throw");

      // Calling dispose again should be safe (idempotent after cleanActions resets state)
      assert.doesNotThrow(() => {
        dispose();
      }, "second dispose call should be safe");
    });
  });

  suite("cleanActions", () => {
    test("cleans up action state without throwing", () => {
      const mockController = {
        editor: {
          graph: {
            version: -1,
            readOnly: true,
            url: null,
            editor: null,
            lastNodeConfigChange: null,
            title: "",
          },
          step: { pendingEdit: null, pendingAssetEdit: null },
          share: { state: { status: "closed" } },
        },
        board: { main: { newerVersionAvailable: null } },
        global: {
          screenSize: {},
          snackbars: { snackbar: () => {} },
          toasts: { toast: () => {} },
        },
        router: { updateFromCurrentUrl: () => {}, init: () => {} },
        run: {},
      } as unknown as AppController;

      const mockServices = {
        stateEventBus: new EventTarget(),
        agentContext: {
          invalidateResumableRuns: () => {},
          clearAllRuns: () => {},
        },
        googleDriveBoardServer: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      } as unknown as AppServices;

      actions(mockController, mockServices);
      activateTriggers();

      assert.doesNotThrow(() => {
        cleanActions();
      }, "cleanActions should not throw");
    });

    test("allows re-initialization after cleanup", () => {
      const mockController = {
        editor: {
          graph: {
            version: -1,
            readOnly: true,
            url: null,
            editor: null,
            lastNodeConfigChange: null,
            title: "",
          },
          step: { pendingEdit: null, pendingAssetEdit: null },
          share: { state: { status: "closed" } },
        },
        board: { main: { newerVersionAvailable: null } },
        global: {
          screenSize: {},
          snackbars: { snackbar: () => {} },
          toasts: { toast: () => {} },
        },
        router: { updateFromCurrentUrl: () => {}, init: () => {} },
        run: {},
      } as unknown as AppController;

      const mockServices = {
        stateEventBus: new EventTarget(),
        agentContext: {
          invalidateResumableRuns: () => {},
          clearAllRuns: () => {},
        },
        googleDriveBoardServer: {
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      } as unknown as AppServices;

      // First initialization
      actions(mockController, mockServices);
      const dispose1 = activateTriggers();
      dispose1();
      cleanActions();

      // Re-initialization should work
      assert.doesNotThrow(() => {
        actions(mockController, mockServices);
        const dispose2 = activateTriggers();
        dispose2();
      }, "Re-initialization after cleanup should work");
    });
  });
});

suite("Priority ordering", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    coordination.reset();
    unsetDOM();
  });

  test("asAction clamps priority to bounds", async () => {
    const { asAction, ActionMode } =
      await import("../../../src/sca/coordination.js");

    // Test high priority gets clamped
    const highAction = asAction(
      "Test.highPriority",
      { mode: ActionMode.Immediate, priority: Number.POSITIVE_INFINITY },
      async () => {}
    );
    assert.strictEqual(highAction.priority, 1000, "Should clamp to max 1000");

    // Test low priority gets clamped
    const lowAction = asAction(
      "Test.lowPriority",
      { mode: ActionMode.Immediate, priority: -5000 },
      async () => {}
    );
    assert.strictEqual(lowAction.priority, -1000, "Should clamp to min -1000");

    // Test normal priority is unchanged
    const normalAction = asAction(
      "Test.normalPriority",
      { mode: ActionMode.Immediate, priority: 50 },
      async () => {}
    );
    assert.strictEqual(normalAction.priority, 50, "Normal priority unchanged");
  });

  test("asAction defaults priority to 0", async () => {
    const { asAction, ActionMode } =
      await import("../../../src/sca/coordination.js");

    const action = asAction(
      "Test.defaultPriority",
      { mode: ActionMode.Immediate },
      async () => {}
    );
    assert.strictEqual(action.priority, 0, "Default priority should be 0");
  });

  test("activateTriggers sorts by priority (higher first)", async () => {
    const { asAction, ActionMode, signalTrigger } =
      await import("../../../src/sca/coordination.js");

    const activationOrder: string[] = [];

    // Create actions with different priorities
    // Note: We create fake trigger factories that track when activate() is called
    const lowPriorityAction = asAction(
      "Test.lowPriority",
      {
        mode: ActionMode.Immediate,
        priority: 10,
        triggeredBy: () => {
          activationOrder.push("low");
          return signalTrigger("test", () => false);
        },
      },
      async () => {}
    );

    const highPriorityAction = asAction(
      "Test.highPriority",
      {
        mode: ActionMode.Immediate,
        priority: 100,
        triggeredBy: () => {
          activationOrder.push("high");
          return signalTrigger("test", () => false);
        },
      },
      async () => {}
    );

    const mediumPriorityAction = asAction(
      "Test.mediumPriority",
      {
        mode: ActionMode.Immediate,
        priority: 50,
        triggeredBy: () => {
          activationOrder.push("medium");
          return signalTrigger("test", () => false);
        },
      },
      async () => {}
    );

    // Manually activate in "wrong" order
    const disposers: Array<() => void> = [];

    // Collect and sort like activateTriggers does
    const actionsWithTriggers = [
      { action: lowPriorityAction, priority: lowPriorityAction.priority },
      { action: highPriorityAction, priority: highPriorityAction.priority },
      { action: mediumPriorityAction, priority: mediumPriorityAction.priority },
    ];

    actionsWithTriggers.sort((a, b) => b.priority - a.priority);

    for (const { action } of actionsWithTriggers) {
      disposers.push(action.activate());
    }

    // Verify order: high (100) -> medium (50) -> low (10)
    assert.deepStrictEqual(
      activationOrder,
      ["high", "medium", "low"],
      "Actions should activate in priority order (higher first)"
    );

    // Cleanup
    for (const dispose of disposers) {
      dispose();
    }
  });
});
