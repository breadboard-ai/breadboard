/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateNodeTitle } from "../../../src/ui/transforms/update-node-title.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

const inChip = (path: string, title: string): TemplatePart => ({
  type: "in",
  path,
  title,
});

const routeChip = (instance: string, title: string): TemplatePart => ({
  type: "tool",
  path: "control-flow/routing",
  instance,
  title,
});

function createMockContext(
  nodes: { id: string; configuration: NodeConfiguration }[],
  graphId = "main"
) {
  const appliedEdits: EditSpec[][] = [];
  const nodeConfigs = new Map(
    nodes.map((n) => [n.id, structuredClone(n.configuration)])
  );

  const makeNodeObj = (id: string) => {
    const config = nodeConfigs.get(id);
    if (!config) return null;
    return {
      descriptor: { id },
      configuration: () => config,
      routes: () => [],
      currentPorts: () => ({
        inputs: { ports: [] },
        outputs: { ports: [] },
      }),
      // AutoWireInPorts needs these:
      ports: async () => ({
        inputs: {
          ports: [],
        },
        outputs: {
          ports: [],
        },
      }),
      incoming: () => [],
      outgoing: () => [],
      title: () => id,
    };
  };

  const inspectable = {
    nodeById: (id: string) => makeNodeObj(id),
    nodes: () =>
      nodes
        .map((n) => makeNodeObj(n.id))
        .filter((n): n is NonNullable<typeof n> => n !== null),
    raw: () => ({ nodes: [], edges: [] }),
  };

  const graphs = new Map([[graphId, inspectable]]);

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      for (const edit of edits) {
        if (edit.type === "changeconfiguration") {
          nodeConfigs.set(edit.id, edit.configuration);
        }
      }
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("UpdateNodeTitle", () => {
  it("updates @-references in other nodes' configurations", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "target-node",
        configuration: configWith("I am the target"),
      },
      {
        id: "referencing-node",
        configuration: configWith(
          `Use ${chip(inChip("target-node", "Old Title"))}`
        ),
      },
    ]);

    const transform = new UpdateNodeTitle("main", "target-node", "New Title");
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    // Should have a changeconfiguration changing the title of the "in" chip
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1);
    const edit = configEdits.find(
      (e) => e.type === "changeconfiguration" && e.id === "referencing-node"
    );
    assert.ok(edit);
    if (edit?.type === "changeconfiguration") {
      const prompt = edit.configuration.prompt as {
        parts: { text: string }[];
      };
      assert.ok(
        prompt.parts[0].text.includes("New Title"),
        "title should be updated"
      );
      assert.ok(
        !prompt.parts[0].text.includes("Old Title"),
        "old title should be gone"
      );
    }
  });

  it("updates routing chiclet titles", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "target-node",
        configuration: configWith("I am the target"),
      },
      {
        id: "routing-node",
        configuration: configWith(
          `Route to ${chip(routeChip("target-node", "Old Route Title"))}`
        ),
      },
    ]);

    const transform = new UpdateNodeTitle(
      "main",
      "target-node",
      "New Route Title"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    const edit = configEdits.find(
      (e) => e.type === "changeconfiguration" && e.id === "routing-node"
    );
    assert.ok(edit);
    if (edit?.type === "changeconfiguration") {
      const prompt = edit.configuration.prompt as {
        parts: { text: string }[];
      };
      assert.ok(
        prompt.parts[0].text.includes("New Route Title"),
        "routing title should be updated"
      );
    }
  });

  it("does nothing when no nodes reference the target", async () => {
    const { context, appliedEdits } = createMockContext([
      { id: "node-a", configuration: configWith("no refs") },
      { id: "node-b", configuration: configWith("also no refs") },
    ]);

    const transform = new UpdateNodeTitle("main", "node-a", "New Title");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 0);
  });

  it("fails if graph is not found", async () => {
    const { context } = createMockContext([], "other");

    const transform = new UpdateNodeTitle("missing", "node-a", "Title");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });
});
