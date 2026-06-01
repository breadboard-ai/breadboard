/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import type { LLMContent } from "@breadboard-ai/types";
import { InputAssetController } from "../../../../../src/sca/controller/subcontrollers/editor/input-assets/input-asset-controller.js";

function makeAsset(text: string): LLMContent {
  return { role: "user", parts: [{ text }] };
}

function makeImageAsset(): LLMContent {
  return {
    role: "user",
    parts: [{ inlineData: { data: "iVBOR...", mimeType: "image/png" } }],
  };
}

suite("InputAssetController", () => {
  suite("initial state", () => {
    test("starts empty", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_1",
        "InputAssetController"
      );
      assert.deepStrictEqual(ctrl.assets, []);
      assert.strictEqual(ctrl.populated, false);
    });
  });

  suite("add", () => {
    test("adds a single asset", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_2",
        "InputAssetController"
      );
      const asset = makeAsset("hello");
      ctrl.add(asset);

      assert.strictEqual(ctrl.assets.length, 1);
      assert.strictEqual(ctrl.populated, true);
      assert.strictEqual(ctrl.assets[0], asset);
    });

    test("adds multiple assets in order", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_3",
        "InputAssetController"
      );
      const a1 = makeAsset("first");
      const a2 = makeImageAsset();
      const a3 = makeAsset("third");

      ctrl.add(a1);
      ctrl.add(a2);
      ctrl.add(a3);

      assert.strictEqual(ctrl.assets.length, 3);
      assert.strictEqual(ctrl.assets[0], a1);
      assert.strictEqual(ctrl.assets[1], a2);
      assert.strictEqual(ctrl.assets[2], a3);
    });
  });

  suite("remove", () => {
    test("removes a specific asset by reference", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_4",
        "InputAssetController"
      );
      const a1 = makeAsset("keep");
      const a2 = makeAsset("remove");
      const a3 = makeAsset("also keep");

      ctrl.add(a1);
      ctrl.add(a2);
      ctrl.add(a3);

      ctrl.remove(a2);

      assert.strictEqual(ctrl.assets.length, 2);
      assert.strictEqual(ctrl.assets[0], a1);
      assert.strictEqual(ctrl.assets[1], a3);
    });

    test("does nothing if asset not found", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_5",
        "InputAssetController"
      );
      const a1 = makeAsset("existing");
      const stranger = makeAsset("not added");

      ctrl.add(a1);
      ctrl.remove(stranger);

      assert.strictEqual(ctrl.assets.length, 1);
      assert.strictEqual(ctrl.assets[0], a1);
    });

    test("sets populated to false when last asset removed", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_6",
        "InputAssetController"
      );
      const asset = makeAsset("only one");

      ctrl.add(asset);
      assert.strictEqual(ctrl.populated, true);

      ctrl.remove(asset);
      assert.strictEqual(ctrl.populated, false);
      assert.deepStrictEqual(ctrl.assets, []);
    });
  });

  suite("drain", () => {
    test("returns all assets and clears the collection", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_7",
        "InputAssetController"
      );
      const a1 = makeAsset("one");
      const a2 = makeAsset("two");

      ctrl.add(a1);
      ctrl.add(a2);

      const drained = ctrl.drain();

      assert.strictEqual(drained.length, 2);
      assert.strictEqual(drained[0], a1);
      assert.strictEqual(drained[1], a2);

      // Controller should now be empty
      assert.strictEqual(ctrl.assets.length, 0);
      assert.strictEqual(ctrl.populated, false);
    });

    test("returns empty array when nothing to drain", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_8",
        "InputAssetController"
      );
      const drained = ctrl.drain();

      assert.deepStrictEqual(drained, []);
      assert.strictEqual(ctrl.populated, false);
    });

    test("drain does not share reference with internal array", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_9",
        "InputAssetController"
      );
      const asset = makeAsset("test");
      ctrl.add(asset);

      const drained = ctrl.drain();

      // Adding after drain should not affect drained array
      ctrl.add(makeAsset("new"));
      assert.strictEqual(drained.length, 1);
      assert.strictEqual(ctrl.assets.length, 1);
    });
  });

  suite("clear", () => {
    test("clears all assets without returning them", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_10",
        "InputAssetController"
      );
      ctrl.add(makeAsset("one"));
      ctrl.add(makeAsset("two"));
      assert.strictEqual(ctrl.populated, true);

      ctrl.clear();

      assert.strictEqual(ctrl.populated, false);
      assert.deepStrictEqual(ctrl.assets, []);
    });

    test("is safe to call on empty controller", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_11",
        "InputAssetController"
      );
      ctrl.clear();
      assert.strictEqual(ctrl.populated, false);
    });
  });

  suite("immutability", () => {
    test("assets getter returns a fresh read-only view", () => {
      const ctrl = new InputAssetController(
        "Test_InputAssets_12",
        "InputAssetController"
      );
      ctrl.add(makeAsset("a"));

      const snap1 = ctrl.assets;
      ctrl.add(makeAsset("b"));
      const snap2 = ctrl.assets;

      // Each add should produce a new array reference
      assert.notStrictEqual(snap1, snap2);
      assert.strictEqual(snap1.length, 1);
      assert.strictEqual(snap2.length, 2);
    });
  });
});
