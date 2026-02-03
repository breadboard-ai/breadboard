/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import { Signal } from "signal-polyfill";
import {
  bind,
  registerStepAutoSaveTrigger,
} from "../../../src/sca/triggers/editor/step-triggers.js";
import { destroy } from "../../../src/sca/triggers/triggers.js";
import { setDOM, unsetDOM } from "../../fake-dom.js";
import { ToastType } from "../../../src/ui/events/events.js";
import type { AppController } from "../../../src/sca/controller/controller.js";
import type { AppActions } from "../../../src/sca/actions/actions.js";
import type { AppServices } from "../../../src/sca/services/services.js";
import type { LLMContent } from "@breadboard-ai/types";
import { flushEffects } from "../helpers/index.js";

/**
 * Creates a mock controller for step trigger tests.
 * Provides all the signals and methods the trigger reads/writes.
 */
function makeStepTriggerController(options: {
  selectionId?: number;
  sidebarSection?: string | null;
  graphVersion?: number;
  pendingEdit?: {
    graphId: string;
    nodeId: string;
    values: Record<string, unknown>;
    graphVersion: number;
  } | null;
  pendingAssetEdit?: {
    title: string;
    dataPart?: { text: string };
    update: (title: string, data?: LLMContent[]) => Promise<void>;
    graphVersion: number;
  } | null;
} = {}) {
  const {
    selectionId = 0,
    sidebarSection = null,
    graphVersion = 1,
    pendingEdit = null,
    pendingAssetEdit = null,
  } = options;

  // Use signals for reactive values
  const selectionSignal = new Signal.State(selectionId);
  const sidebarSignal = new Signal.State(sidebarSection);
  const graphVersionSignal = new Signal.State(graphVersion);
  const pendingEditSignal = new Signal.State(pendingEdit);
  const pendingAssetEditSignal = new Signal.State(pendingAssetEdit);

  // Track calls manually for type-safe assertions
  const toastCalls: Array<{ message: string; type: ToastType }> = [];
  let clearPendingEditCalled = 0;
  let clearPendingAssetEditCalled = 0;

  const toastMock = (message: string, type: ToastType) => {
    toastCalls.push({ message, type });
  };
  const clearPendingEditMock = () => {
    clearPendingEditCalled++;
    pendingEditSignal.set(null);
  };
  const clearPendingAssetEditMock = () => {
    clearPendingAssetEditCalled++;
    pendingAssetEditSignal.set(null);
  };

  return {
    controller: {
      global: {
        toasts: {
          toast: toastMock,
        },
      },
      editor: {
        selection: {
          get selectionId() {
            return selectionSignal.get();
          },
        },
        sidebar: {
          get section() {
            return sidebarSignal.get();
          },
        },
        graph: {
          get version() {
            return graphVersionSignal.get();
          },
        },
        step: {
          get pendingEdit() {
            return pendingEditSignal.get();
          },
          get pendingAssetEdit() {
            return pendingAssetEditSignal.get();
          },
          clearPendingEdit: clearPendingEditMock,
          clearPendingAssetEdit: clearPendingAssetEditMock,
        },
      },
    } as unknown as AppController,
    getToastCalls: () => toastCalls,
    getClearPendingEditCount: () => clearPendingEditCalled,
    getClearPendingAssetEditCount: () => clearPendingAssetEditCalled,
    signals: {
      selection: selectionSignal,
      sidebar: sidebarSignal,
      graphVersion: graphVersionSignal,
      pendingEdit: pendingEditSignal,
      pendingAssetEdit: pendingAssetEditSignal,
    },
  };
}

/**
 * Creates mock actions for step trigger tests.
 */
function makeStepTriggerActions() {
  const calls: Array<{
    nodeId: string;
    graphId: string;
    values: Record<string, unknown>;
  }> = [];

  return {
    actions: {
      graph: {
        changeNodeConfiguration: async (
          nodeId: string,
          graphId: string,
          values: Record<string, unknown>
        ) => {
          calls.push({ nodeId, graphId, values });
        },
      },
    } as unknown as AppActions,
    getNodeConfigCalls: () => calls,
  };
}

suite("Step Triggers", () => {
  before(() => {
    setDOM();
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    bind.clean();
    destroy();
  });

  suite("registerStepAutoSaveTrigger", () => {
    test("registers without error", () => {
      const { controller } = makeStepTriggerController();
      const { actions } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      assert.doesNotThrow(() => {
        registerStepAutoSaveTrigger();
      });
    });

    test("applies pending edit when versions match", async () => {
      const {
        controller,
        signals,
        getClearPendingEditCount,
        getToastCalls,
      } = makeStepTriggerController({
        graphVersion: 5,
        pendingEdit: {
          graphId: "test-graph",
          nodeId: "test-node",
          values: { prompt: "Hello" },
          graphVersion: 5, // matches current
        },
      });
      const { actions, getNodeConfigCalls } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      // Trigger by changing selection
      signals.selection.set(1);
      await flushEffects();

      // Should have called changeNodeConfiguration with correct args
      const calls = getNodeConfigCalls();
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].nodeId, "test-node");
      assert.strictEqual(calls[0].graphId, "test-graph");
      assert.deepStrictEqual(calls[0].values, { prompt: "Hello" });

      // Should have cleared pending edit
      assert.strictEqual(getClearPendingEditCount(), 1);

      // Should NOT show toast
      assert.strictEqual(getToastCalls().length, 0);
    });

    test("discards stale edit and shows toast when versions differ", async () => {
      const {
        controller,
        signals,
        getClearPendingEditCount,
        getToastCalls,
      } = makeStepTriggerController({
        graphVersion: 10, // current version
        pendingEdit: {
          graphId: "test-graph",
          nodeId: "test-node",
          values: { prompt: "Stale" },
          graphVersion: 5, // edit was made at older version
        },
      });
      const { actions, getNodeConfigCalls } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      // Trigger by changing selection
      signals.selection.set(1);
      await flushEffects();

      // Should NOT apply the edit
      assert.strictEqual(getNodeConfigCalls().length, 0);

      // Should clear pending edit
      assert.strictEqual(getClearPendingEditCount(), 1);

      // Should show warning toast
      const toasts = getToastCalls();
      assert.strictEqual(toasts.length, 1);
      assert.strictEqual(toasts[0].type, ToastType.WARNING);
    });

    test("applies pending asset edit when versions match", async () => {
      const assetUpdateCalls: Array<{ title: string; data: LLMContent[] | undefined }> = [];
      const updateMock = async (title: string, data?: LLMContent[]) => {
        assetUpdateCalls.push({ title, data });
      };

      const {
        controller,
        signals,
        getClearPendingAssetEditCount,
        getToastCalls,
      } = makeStepTriggerController({
        graphVersion: 3,
        pendingAssetEdit: {
          title: "My Asset",
          dataPart: { text: "Asset content" },
          update: updateMock,
          graphVersion: 3, // matches
        },
      });
      const { actions } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      // Trigger by changing sidebar
      signals.sidebar.set("assets");
      await flushEffects();

      // Should have called update
      assert.strictEqual(assetUpdateCalls.length, 1);
      assert.strictEqual(assetUpdateCalls[0].title, "My Asset");
      // Data should be wrapped in LLMContent array
      assert.deepStrictEqual(assetUpdateCalls[0].data, [
        { role: "user", parts: [{ text: "Asset content" }] },
      ]);

      // Should have cleared pending asset edit
      assert.strictEqual(getClearPendingAssetEditCount(), 1);

      // Should NOT show toast
      assert.strictEqual(getToastCalls().length, 0);
    });

    test("discards stale asset edit and shows toast when versions differ", async () => {
      let updateCalled = false;
      const updateMock = async () => {
        updateCalled = true;
      };

      const {
        controller,
        signals,
        getClearPendingAssetEditCount,
        getToastCalls,
      } = makeStepTriggerController({
        graphVersion: 8,
        pendingAssetEdit: {
          title: "Old Asset",
          update: updateMock,
          graphVersion: 2, // stale
        },
      });
      const { actions } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      // Trigger by changing selection
      signals.selection.set(2);
      await flushEffects();

      // Should NOT apply
      assert.strictEqual(updateCalled, false);

      // Should clear
      assert.strictEqual(getClearPendingAssetEditCount(), 1);

      // Should show toast
      assert.strictEqual(getToastCalls().length, 1);
    });

    test("handles asset edit without dataPart", async () => {
      const assetUpdateCalls: Array<{ title: string; data: LLMContent[] | undefined }> = [];
      const updateMock = async (title: string, data?: LLMContent[]) => {
        assetUpdateCalls.push({ title, data });
      };

      const { controller, signals } = makeStepTriggerController({
        graphVersion: 1,
        pendingAssetEdit: {
          title: "Title Only",
          update: updateMock,
          graphVersion: 1,
        },
      });
      const { actions } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      signals.selection.set(1);
      await flushEffects();

      // Should call update with undefined data
      assert.strictEqual(assetUpdateCalls.length, 1);
      assert.strictEqual(assetUpdateCalls[0].title, "Title Only");
      assert.strictEqual(assetUpdateCalls[0].data, undefined);
    });

    test("handles both pending edits simultaneously", async () => {
      let assetUpdateCalled = false;
      const assetUpdateMock = async () => {
        assetUpdateCalled = true;
      };

      const {
        controller,
        signals,
        getClearPendingEditCount,
        getClearPendingAssetEditCount,
      } = makeStepTriggerController({
        graphVersion: 1,
        pendingEdit: {
          graphId: "g",
          nodeId: "n",
          values: { x: 1 },
          graphVersion: 1,
        },
        pendingAssetEdit: {
          title: "A",
          update: assetUpdateMock,
          graphVersion: 1,
        },
      });
      const { actions, getNodeConfigCalls } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      signals.selection.set(1);
      await flushEffects();

      // Both should be applied
      assert.strictEqual(getNodeConfigCalls().length, 1);
      assert.strictEqual(assetUpdateCalled, true);

      // Both should be cleared
      assert.strictEqual(getClearPendingEditCount(), 1);
      assert.strictEqual(getClearPendingAssetEditCount(), 1);
    });

    test("does nothing when no pending edits", async () => {
      const {
        controller,
        signals,
        getClearPendingEditCount,
        getClearPendingAssetEditCount,
        getToastCalls,
      } = makeStepTriggerController({
        graphVersion: 1,
        pendingEdit: null,
        pendingAssetEdit: null,
      });
      const { actions, getNodeConfigCalls } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      signals.selection.set(1);
      await flushEffects();

      // Nothing should be called
      assert.strictEqual(getNodeConfigCalls().length, 0);
      assert.strictEqual(getClearPendingEditCount(), 0);
      assert.strictEqual(getClearPendingAssetEditCount(), 0);
      assert.strictEqual(getToastCalls().length, 0);
    });

    test("fires on sidebar change", async () => {
      const {
        controller,
        signals,
        getClearPendingEditCount,
      } = makeStepTriggerController({
        graphVersion: 1,
        pendingEdit: {
          graphId: "g",
          nodeId: "n",
          values: {},
          graphVersion: 1,
        },
      });
      const { actions, getNodeConfigCalls } = makeStepTriggerActions();

      bind({ controller, services: {} as AppServices, actions });
      registerStepAutoSaveTrigger();
      await flushEffects();

      // Change sidebar instead of selection
      signals.sidebar.set("steps");
      await flushEffects();

      // Should still fire and apply
      assert.strictEqual(getNodeConfigCalls().length, 1);
      assert.strictEqual(getClearPendingEditCount(), 1);
    });
  });
});
