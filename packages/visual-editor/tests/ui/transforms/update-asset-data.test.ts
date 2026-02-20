/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateAssetData } from "../../../src/ui/transforms/update-asset-data.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types";

function createMockContext() {
  const appliedEdits: EditSpec[][] = [];
  const context = {
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;
  return { context, appliedEdits };
}

describe("UpdateAssetData", () => {
  it("emits an addasset edit with the correct path and metadata", async () => {
    const { context, appliedEdits } = createMockContext();

    const metadata = { title: "My Asset", type: "content" as const };
    const data = [{ parts: [{ text: "hello" }] }];
    const transform = new UpdateAssetData("assets/img.png", metadata, data);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    assert.equal(edit.type, "addasset");
    if (edit.type === "addasset") {
      assert.equal(edit.path, "assets/img.png");
      assert.equal(edit.metadata?.title, "My Asset");
    }
  });

  it("passes through data as NodeValue", async () => {
    const { context, appliedEdits } = createMockContext();

    const data = [
      { parts: [{ text: "part 1" }] },
      { parts: [{ text: "part 2" }] },
    ];
    const transform = new UpdateAssetData(
      "assets/doc.txt",
      { title: "Doc", type: "content" },
      data
    );
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "addasset") {
      const editData = edit.data as { parts: { text: string }[] }[];
      assert.equal(editData.length, 2);
      assert.equal(editData[0].parts[0].text, "part 1");
      assert.equal(editData[1].parts[0].text, "part 2");
    }
  });
});
