/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { EditConnector } from "../../../src/ui/transforms/edit-connector.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeValue,
} from "@breadboard-ai/types";
import type { ConnectorConfiguration } from "../../../src/ui/connectors/types.js";

function connectorData(config: ConnectorConfiguration): NodeValue {
  return [{ parts: [{ json: config }] }];
}

function createMockContext(opts: {
  asset?: {
    metadata?: { title: string; type: string };
    data: NodeValue;
  } | null;
}) {
  const appliedEdits: EditSpec[][] = [];
  const path = "connectors/conn-1";

  const assets: Record<string, unknown> = {};
  if (opts.asset !== null && opts.asset !== undefined) {
    assets[path] = opts.asset;
  }

  const context = {
    graph: { assets },
    mutable: { graphs: new Map() },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits, path };
}

describe("EditConnector", () => {
  it("fails if asset does not exist", async () => {
    const { context, path } = createMockContext({ asset: null });

    const transform = new EditConnector(path, "Title", {
      url: "https://example.com",
      configuration: {},
    });
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("doesn't exist"));
    }
  });

  it("fails if asset has no metadata", async () => {
    const { context, path } = createMockContext({
      asset: {
        metadata: undefined as unknown as { title: string; type: string },
        data: connectorData({ url: "https://old.com", configuration: {} }),
      },
    });

    const transform = new EditConnector(path, "Title", {
      url: "https://new.com",
      configuration: {},
    });
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("not yet been initialized"));
    }
  });

  it("does nothing when config is the same and title unchanged", async () => {
    const config: ConnectorConfiguration = {
      url: "https://example.com",
      configuration: { key: "val" },
    };
    const { context, appliedEdits, path } = createMockContext({
      asset: {
        metadata: { title: "My Conn", type: "connector" },
        data: connectorData(config),
      },
    });

    const transform = new EditConnector(path, undefined, config);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 0, "no edits when nothing changed");
  });

  it("updates title only when config is unchanged", async () => {
    const config: ConnectorConfiguration = {
      url: "https://example.com",
      configuration: { key: "val" },
    };

    const inspectable = {
      nodes: () => [],
      metadata: () => ({}),
    };
    const graphs = new Map<string, unknown>([["", inspectable]]);

    const appliedEdits: EditSpec[][] = [];
    const path = "connectors/conn-1";
    const context = {
      graph: {
        assets: {
          [path]: {
            metadata: { title: "Old Title", type: "connector" },
            data: connectorData(config),
          },
        },
        nodes: [],
        edges: [],
        graphs: {},
      },
      mutable: { graphs },
      apply: mock.fn(
        async (edits: EditSpec[]): Promise<EditTransformResult> => {
          appliedEdits.push(edits);
          return { success: true };
        }
      ),
    } as unknown as EditOperationContext;

    // Same config but different title
    const transform = new EditConnector(path, "New Title", config);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should call apply for UpdateAssetWithRefs (addasset)
    assert.ok(appliedEdits.length >= 1);
  });

  it("replaces asset when config changes", async () => {
    const oldConfig: ConnectorConfiguration = {
      url: "https://old.com",
      configuration: { key: "old" },
    };
    const newConfig: ConnectorConfiguration = {
      url: "https://new.com",
      configuration: { key: "new" },
    };
    const { context, appliedEdits, path } = createMockContext({
      asset: {
        metadata: { title: "My Conn", type: "connector" },
        data: connectorData(oldConfig),
      },
    });

    const transform = new EditConnector(path, undefined, newConfig);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have removeasset + addasset
    const allEdits = appliedEdits.flat();
    const removeEdits = allEdits.filter((e) => e.type === "removeasset");
    const addEdits = allEdits.filter((e) => e.type === "addasset");
    assert.equal(removeEdits.length, 1);
    assert.equal(addEdits.length, 1);
  });

  it("replaces asset and updates refs when both config and title change", async () => {
    const oldConfig: ConnectorConfiguration = {
      url: "https://old.com",
      configuration: {},
    };
    const newConfig: ConnectorConfiguration = {
      url: "https://new.com",
      configuration: {},
    };

    // Need nodes for UpdateAssetRefs to iterate
    const inspectable = {
      nodes: () => [],
    };
    const graphs = new Map([["", inspectable]]);

    const appliedEdits: EditSpec[][] = [];
    const path = "connectors/conn-1";
    const context = {
      graph: {
        assets: {
          [path]: {
            metadata: { title: "Old", type: "connector" },
            data: connectorData(oldConfig),
          },
        },
        nodes: [],
        edges: [],
        graphs: {},
      },
      mutable: { graphs },
      apply: mock.fn(
        async (edits: EditSpec[]): Promise<EditTransformResult> => {
          appliedEdits.push(edits);
          return { success: true };
        }
      ),
    } as unknown as EditOperationContext;

    const transform = new EditConnector(path, "New Title", newConfig);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have: removeasset + addasset, then UpdateAssetRefs edits
    assert.ok(appliedEdits.length >= 1);
  });
});
