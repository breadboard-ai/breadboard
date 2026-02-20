/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CreateConnector } from "../../../src/ui/transforms/create-connector.js";
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

describe("CreateConnector", () => {
  it("emits an addasset edit with correct path", async () => {
    const { context, appliedEdits } = createMockContext();

    const transform = new CreateConnector(
      "https://example.com/connector.bgl.json",
      "my-connector-id",
      { title: "My Connector", configuration: { key: "val" } }
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    assert.equal(edit.type, "addasset");
    if (edit.type === "addasset") {
      assert.equal(edit.path, "connectors/my-connector-id");
    }
  });

  it("stores the URL and configuration in the asset data", async () => {
    const { context, appliedEdits } = createMockContext();

    const transform = new CreateConnector(
      "https://example.com/conn.bgl.json",
      "conn-1",
      { title: "Conn", configuration: { foo: "bar" } }
    );
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "addasset") {
      const data = edit.data as { parts: { json: unknown }[] }[];
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 1);
      const json = data[0].parts[0].json as {
        url: string;
        configuration: unknown;
      };
      assert.equal(json.url, "https://example.com/conn.bgl.json");
      assert.deepEqual(json.configuration, { foo: "bar" });
    }
  });

  it("sets the correct metadata with title and type", async () => {
    const { context, appliedEdits } = createMockContext();

    const transform = new CreateConnector(
      "https://example.com/conn.bgl.json",
      "conn-2",
      { title: "Weather Connector", configuration: {} }
    );
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "addasset") {
      assert.equal(edit.metadata?.title, "Weather Connector");
      assert.equal(edit.metadata?.type, "connector");
    }
  });
});
