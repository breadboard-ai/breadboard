/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { StepController } from "../../../../../../src/sca/controller/subcontrollers/editor/step/step-controller.js";
import { unwrap } from "../../../../../../src/sca/controller/decorators/utils/wrap-unwrap.js";
import type {
  PendingEdit,
  PendingAssetEdit,
} from "../../../../../../src/sca/types.js";

suite("StepController", () => {
  suite("pendingEdit", () => {
    test("initially returns null", async () => {
      const controller = new StepController("Step_1", "StepController");
      await controller.isHydrated;

      assert.strictEqual(controller.pendingEdit, null);
    });

    test("setPendingEdit stores the edit correctly", async () => {
      const controller = new StepController("Step_2", "StepController");
      await controller.isHydrated;

      const edit: PendingEdit = {
        graphId: "test-graph",
        nodeId: "test-node",
        values: { prompt: "Hello world" },
        graphVersion: 1,
      };

      controller.setPendingEdit(edit);
      await controller.isSettled;

      assert.deepStrictEqual(unwrap(controller.pendingEdit), edit);
    });

    test("clearPendingEdit clears the edit", async () => {
      const controller = new StepController("Step_3", "StepController");
      await controller.isHydrated;

      controller.setPendingEdit({
        graphId: "test-graph",
        nodeId: "test-node",
        values: { prompt: "Hello" },
        graphVersion: 1,
      });
      await controller.isSettled;
      assert.ok(controller.pendingEdit !== null);

      controller.clearPendingEdit();
      await controller.isSettled;
      assert.strictEqual(controller.pendingEdit, null);
    });

    test("setPendingEdit replaces previous edit", async () => {
      const controller = new StepController("Step_4", "StepController");
      await controller.isHydrated;

      const edit1: PendingEdit = {
        graphId: "graph-1",
        nodeId: "node-1",
        values: { prompt: "First" },
        graphVersion: 1,
      };
      const edit2: PendingEdit = {
        graphId: "graph-2",
        nodeId: "node-2",
        values: { prompt: "Second" },
        graphVersion: 2,
      };

      controller.setPendingEdit(edit1);
      await controller.isSettled;
      controller.setPendingEdit(edit2);
      await controller.isSettled;

      assert.deepStrictEqual(unwrap(controller.pendingEdit), edit2);
    });

    test("pendingEdit preserves complex values", async () => {
      const controller = new StepController("Step_5", "StepController");
      await controller.isHydrated;

      const edit: PendingEdit = {
        graphId: "test-graph",
        nodeId: "test-node",
        values: {
          prompt: "Hello",
          temperature: 0.7,
          nested: { foo: "bar", arr: [1, 2, 3] },
        },
        graphVersion: 42,
      };

      controller.setPendingEdit(edit);
      await controller.isSettled;

      assert.deepStrictEqual(unwrap(controller.pendingEdit), edit);
    });
  });

  suite("pendingAssetEdit", () => {
    test("initially returns null", async () => {
      const controller = new StepController("Step_6", "StepController");
      await controller.isHydrated;

      assert.strictEqual(controller.pendingAssetEdit, null);
    });

    test("setPendingAssetEdit stores the edit correctly", async () => {
      const controller = new StepController("Step_7", "StepController");
      await controller.isHydrated;

      const dataPart = { text: "Asset content" };
      const edit: PendingAssetEdit = {
        assetPath: "assets/test-asset",
        title: "Test Asset",
        dataPart,
        graphVersion: 1,
      };

      controller.setPendingAssetEdit(edit);
      await controller.isSettled;

      const stored = controller.pendingAssetEdit;
      assert.ok(stored !== null);
      assert.strictEqual(stored.title, "Test Asset");
      assert.deepStrictEqual(stored.dataPart, dataPart);
      assert.strictEqual(stored.graphVersion, 1);
    });

    test("clearPendingAssetEdit clears the edit", async () => {
      const controller = new StepController("Step_8", "StepController");
      await controller.isHydrated;

      controller.setPendingAssetEdit({
        assetPath: "assets/test",
        title: "Test",
        dataPart: null,
        graphVersion: 1,
      });
      await controller.isSettled;
      assert.ok(controller.pendingAssetEdit !== null);

      controller.clearPendingAssetEdit();
      await controller.isSettled;
      assert.strictEqual(controller.pendingAssetEdit, null);
    });

    test("pendingAssetEdit without dataPart", async () => {
      const controller = new StepController("Step_9", "StepController");
      await controller.isHydrated;

      const edit: PendingAssetEdit = {
        assetPath: "assets/title-only",
        title: "Title Only",
        dataPart: null,
        graphVersion: 5,
      };

      controller.setPendingAssetEdit(edit);
      await controller.isSettled;

      const stored = controller.pendingAssetEdit;
      assert.ok(stored !== null);
      assert.strictEqual(stored.title, "Title Only");
      assert.strictEqual(stored.dataPart, null);
    });
  });

  suite("independent edit states", () => {
    test("pendingEdit and pendingAssetEdit are independent", async () => {
      const controller = new StepController("Step_10", "StepController");
      await controller.isHydrated;

      const nodeEdit: PendingEdit = {
        graphId: "graph",
        nodeId: "node",
        values: { prompt: "Test" },
        graphVersion: 1,
      };
      const assetEdit: PendingAssetEdit = {
        assetPath: "assets/asset",
        title: "Asset",
        dataPart: null,
        graphVersion: 1,
      };

      controller.setPendingEdit(nodeEdit);
      controller.setPendingAssetEdit(assetEdit);
      await controller.isSettled;

      assert.ok(controller.pendingEdit !== null);
      assert.ok(controller.pendingAssetEdit !== null);

      // Clearing one doesn't affect the other
      controller.clearPendingEdit();
      await controller.isSettled;

      assert.strictEqual(controller.pendingEdit, null);
      assert.ok(controller.pendingAssetEdit !== null);
    });

    test("can have both edits simultaneously", async () => {
      const controller = new StepController("Step_11", "StepController");
      await controller.isHydrated;

      controller.setPendingEdit({
        graphId: "g",
        nodeId: "n",
        values: {},
        graphVersion: 1,
      });
      controller.setPendingAssetEdit({
        assetPath: "assets/a",
        title: "a",
        dataPart: null,
        graphVersion: 1,
      });
      await controller.isSettled;

      assert.ok(controller.pendingEdit !== null);
      assert.ok(controller.pendingAssetEdit !== null);

      // Clear both
      controller.clearPendingEdit();
      controller.clearPendingAssetEdit();
      await controller.isSettled;

      assert.strictEqual(controller.pendingEdit, null);
      assert.strictEqual(controller.pendingAssetEdit, null);
    });
  });
});
