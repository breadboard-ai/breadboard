/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import type { AssetMetadata, LLMContent } from "@breadboard-ai/types";
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

      const metadata: AssetMetadata = {
        title: "Image Attachment",
        type: "file",
        subType: "image/png",
      };

      await InputAsset.addFromModal(asset, metadata);

      assert.strictEqual(inputAssets.assets.length, 1);
      assert.strictEqual(inputAssets.assets[0].metadata?.title, "Image Attachment");
      assert.strictEqual(inputAssets.assets[0].data[0], asset);
    });

    test("throws an error when adding raw LLMContent without metadata", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const asset: LLMContent = {
        role: "user",
        parts: [{ text: "missing metadata" }],
      };

      await assert.rejects(
        InputAsset.addFromModal(asset),
        /Metadata is required when adding raw LLMContent assets/
      );
    });

    test("adds an asset with explicit AssetMetadata", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const asset: LLMContent = {
        role: "user",
        parts: [{ inlineData: { data: "base64", mimeType: "application/pdf" } }],
      };

      const metadata: AssetMetadata = {
        title: "Report.pdf",
        type: "file",
        subType: "application/pdf",
      };

      await InputAsset.addFromModal(asset, metadata);

      assert.strictEqual(inputAssets.assets.length, 1);
      assert.strictEqual(inputAssets.assets[0].metadata?.title, "Report.pdf");
      assert.strictEqual(inputAssets.assets[0].metadata?.subType, "application/pdf");
      assert.strictEqual(inputAssets.assets[0].metadata?.type, "file");
      assert.ok(inputAssets.assets[0].path.endsWith(".pdf"));
    });

    test("derives correct file extension from subType fallback", async () => {
      const inputAssets = makeInputAssetController();
      bindWithController(inputAssets);

      const asset: LLMContent = {
        role: "user",
        parts: [{ inlineData: { data: "csvdata", mimeType: "text/csv" } }],
      };

      const metadata: AssetMetadata = {
        title: "data",
        type: "file",
        subType: "text/csv",
      };

      await InputAsset.addFromModal(asset, metadata);

      assert.strictEqual(inputAssets.assets.length, 1);
      assert.ok(inputAssets.assets[0].path.endsWith(".csv"));
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

      const m1: AssetMetadata = { title: "first", type: "file" };
      const m2: AssetMetadata = { title: "img", type: "file", subType: "image/jpeg" };

      await InputAsset.addFromModal(a1, m1);
      await InputAsset.addFromModal(a2, m2);

      assert.strictEqual(inputAssets.assets.length, 2);
      assert.strictEqual(inputAssets.assets[0].data[0], a1);
      assert.strictEqual(inputAssets.assets[1].data[0], a2);
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
      assert.strictEqual(first.metadata?.title, "My Notebook");
      assert.strictEqual(first.metadata?.type, "file");
      assert.ok(first.path);
      assert.strictEqual(first.data.length, 1);
      assert.strictEqual(first.data[0].role, "user");
      assert.strictEqual(first.data[0].parts.length, 1);
      const firstPart = first.data[0].parts[0];
      assert.ok("storedData" in firstPart);
      assert.strictEqual(
        firstPart.storedData.handle,
        toNotebookLmUrl("abc123")
      );
      assert.strictEqual(firstPart.storedData.mimeType, NOTEBOOKLM_MIMETYPE);

      // Second notebook
      const second = inputAssets.assets[1];
      assert.strictEqual(second.metadata?.title, "Other Notebook");
      assert.strictEqual(second.metadata?.type, "file");
      assert.ok(second.path);
      const secondPart = second.data[0].parts[0];
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
