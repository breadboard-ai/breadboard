/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import type { LLMContent } from "@breadboard-ai/types";
import * as InputAsset from "../../../../src/sca/actions/input-asset/input-asset-actions.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { InputAssetController } from "../../../../src/sca/controller/subcontrollers/editor/input-assets/input-asset-controller.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";
import { NOTEBOOKLM_MIMETYPE, toNotebookLmUrl } from "@breadboard-ai/utils";

function makeInputAssetController(): InputAssetController {
  return new InputAssetController("Test_InputAssets", "InputAssetController");
}

function bindWithController(inputAssets: InputAssetController) {
  InputAsset.bind({
    services: {} as AppServices,
    controller: {
      editor: {
        inputAssets,
      },
    } as unknown as AppController,
    env: createMockEnvironment(defaultRuntimeFlags),
  });
}

suite("InputAsset Actions", () => {
  suite("addFromModal", () => {
    test("adds an asset to the input asset controller", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const asset: LLMContent = {
        role: "user",
        parts: [{ inlineData: { data: "base64data", mimeType: "image/png" } }],
      };

      await InputAsset.addFromModal(asset);

      assert.strictEqual(inputAssets.assets.length, 1);
      assert.strictEqual(inputAssets.assets[0], asset);
    });

    test("adds multiple assets sequentially", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const a1: LLMContent = {
        role: "user",
        parts: [{ text: "first" }],
      };
      const a2: LLMContent = {
        role: "user",
        parts: [{ inlineData: { data: "img", mimeType: "image/jpeg" } }],
      };

      await InputAsset.addFromModal(a1);
      await InputAsset.addFromModal(a2);

      assert.strictEqual(inputAssets.assets.length, 2);
      assert.strictEqual(inputAssets.assets[0], a1);
      assert.strictEqual(inputAssets.assets[1], a2);
    });
  });

  suite("addFromNotebookLm", () => {
    test("converts notebooks to LLMContent and adds them", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const notebooks = [
        { id: "abc123", name: "notebooks/abc123", preview: "My Notebook" },
        {
          id: "def456",
          name: "notebooks/def456",
          preview: "Other Notebook",
          emoji: "📝",
        },
      ];

      await InputAsset.addFromNotebookLm(notebooks);

      assert.strictEqual(inputAssets.assets.length, 2);

      // First notebook
      const first = inputAssets.assets[0];
      assert.strictEqual(first.role, "user");
      assert.strictEqual(first.parts.length, 1);
      const firstPart = first.parts[0];
      assert.ok("storedData" in firstPart);
      assert.strictEqual(
        firstPart.storedData.handle,
        toNotebookLmUrl("abc123")
      );
      assert.strictEqual(firstPart.storedData.mimeType, NOTEBOOKLM_MIMETYPE);

      // Second notebook
      const second = inputAssets.assets[1];
      const secondPart = second.parts[0];
      assert.ok("storedData" in secondPart);
      assert.strictEqual(
        secondPart.storedData.handle,
        toNotebookLmUrl("def456")
      );
    });

    test("handles empty notebook array", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      await InputAsset.addFromNotebookLm([]);

      assert.strictEqual(inputAssets.assets.length, 0);
      assert.strictEqual(inputAssets.populated, false);
    });
  });
});
