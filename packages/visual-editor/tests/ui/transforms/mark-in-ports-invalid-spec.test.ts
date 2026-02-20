/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { MarkInPortsInvalidSpec } from "../../../src/ui/transforms/mark-in-ports-invalid-spec.js";
import { routingConfig } from "./mock-edit-context.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";

/**
 * Creates a mock context suitable for MarkInPortsInvalidSpec tests.
 *
 * MarkInPortsInvalidSpec first calls `context.apply(spec)` (first pass),
 * then uses TransformAllNodes which calls `context.mutable.graphs.get(...)`
 * → `nodes()` → for each node: `configuration()` → then
 * `context.apply([changeconfiguration, ...])`.
 *
 * We track all apply calls and provide minimal nodes with configuration.
 */
function createInvalidSpecContext(
  nodes: { id: string; configuration: NodeConfiguration }[],
  graphId = ""
) {
  const appliedEdits: EditSpec[][] = [];

  // Keep mutable configuration so we can check what the transform writes.
  const nodeConfigs = new Map(
    nodes.map((n) => [n.id, structuredClone(n.configuration)])
  );

  const inspectable = {
    nodeById: (id: string) => {
      const config = nodeConfigs.get(id);
      if (!config) return null;
      return { descriptor: { id }, configuration: () => config };
    },
    nodes: () =>
      nodes.map((n) => ({
        descriptor: { id: n.id },
        configuration: () => nodeConfigs.get(n.id)!,
      })),
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

  return { context, appliedEdits, nodeConfigs };
}

/**
 * Helper to build a routing edge spec that matches the format created by
 * ChangeEdgesToRoutingMode: { from, to, out: to, in: "context" }.
 */
function routingEdge(from: string, to: string): EditSpec {
  return {
    type: "removeedge",
    graphId: "",
    edge: { from, to, out: to, in: "context" },
  };
}

/** Extract the prompt text from a changeconfiguration edit. */
function promptTextFrom(edit: EditSpec): string {
  if (edit.type !== "changeconfiguration") {
    throw new Error(`Expected changeconfiguration, got ${edit.type}`);
  }
  const parts = (
    edit.configuration.config$prompt as { parts: { text: string }[] }
  ).parts;
  return parts[0].text;
}

describe("MarkInPortsInvalidSpec — routing edge removal", () => {
  it("unsets routing target when routing edge is deleted", async () => {
    const config = routingConfig("target-1");

    const { context, appliedEdits } = createInvalidSpecContext(
      [{ id: "source", configuration: config }],
      ""
    );

    const transform = new MarkInPortsInvalidSpec([
      routingEdge("source", "target-1"),
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    // Should have at least 2 apply calls:
    // 1. First pass: the removeedge spec
    // 2. Second pass: changeconfiguration to update the routing part
    assert.ok(
      appliedEdits.length >= 2,
      `Expected at least 2 apply calls, got ${appliedEdits.length}`
    );

    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 1, "should have one config change");

    const text = promptTextFrom(configEdits[0]);
    // The chiclet should still exist (type "tool", path "control-flow/routing")
    // but the instance (target) should be gone.
    assert.ok(
      text.includes("control-flow/routing"),
      "routing chiclet should still exist"
    );
    assert.ok(!text.includes("target-1"), "target-1 instance should be unset");
    assert.ok(
      !text.includes('"instance"'),
      "instance field should not be present"
    );
  });

  it("preserves non-routing template parts when routing edge is deleted", async () => {
    const inChiclet = `{{"type":"in","path":"other-node","title":"@other-node"}}`;
    const routeChiclet = `{{"type":"tool","path":"control-flow/routing","instance":"target-1","title":"Target"}}`;
    const config: NodeConfiguration = {
      config$prompt: {
        role: "user",
        parts: [{ text: `${inChiclet} then ${routeChiclet}` }],
      },
    };

    const { context, appliedEdits } = createInvalidSpecContext(
      [{ id: "source", configuration: config }],
      ""
    );

    const transform = new MarkInPortsInvalidSpec([
      routingEdge("source", "target-1"),
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1, "should have config change");

    const text = promptTextFrom(configEdits[0]);
    assert.ok(
      text.includes("other-node"),
      "non-routing chiclet should be preserved"
    );
    assert.ok(
      text.includes("control-flow/routing"),
      "routing chiclet should still exist"
    );
    assert.ok(!text.includes("target-1"), "routing target should be unset");
  });

  it("unsets only the targeted route when multiple routes exist", async () => {
    const config = routingConfig("target-1", "target-2");

    const { context, appliedEdits } = createInvalidSpecContext(
      [{ id: "source", configuration: config }],
      ""
    );

    const transform = new MarkInPortsInvalidSpec([
      routingEdge("source", "target-1"),
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1, "should have config change");

    const text = promptTextFrom(configEdits[0]);
    assert.ok(!text.includes('"target-1"'), "target-1 should be unset");
    assert.ok(text.includes('"target-2"'), "target-2 should be preserved");
  });

  it("unsets multiple route targets deleted at once", async () => {
    const config = routingConfig("target-1", "target-2", "target-3");

    const { context, appliedEdits } = createInvalidSpecContext(
      [{ id: "source", configuration: config }],
      ""
    );

    const transform = new MarkInPortsInvalidSpec([
      routingEdge("source", "target-1"),
      routingEdge("source", "target-3"),
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1, "should have config change");

    const text = promptTextFrom(configEdits[0]);
    assert.ok(!text.includes('"target-1"'), "target-1 should be unset");
    assert.ok(text.includes('"target-2"'), "target-2 should be preserved");
    assert.ok(!text.includes('"target-3"'), "target-3 should be unset");
  });

  it("skips non-routing edges (out !== to)", async () => {
    const config = routingConfig("target-1");

    const { context, appliedEdits } = createInvalidSpecContext(
      [{ id: "source", configuration: config }],
      ""
    );

    // Edge where out !== to — not a routing edge, should be skipped.
    const spec: EditSpec[] = [
      {
        type: "removeedge",
        graphId: "",
        edge: {
          from: "source",
          to: "target-1",
          out: "some-other-port",
          in: "context",
        },
      },
    ];

    const transform = new MarkInPortsInvalidSpec(spec);
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    // Only the first-pass apply should be called (no config changes).
    assert.equal(
      appliedEdits.length,
      1,
      "should only have the first-pass edit (no config changes)"
    );
  });
});

describe("MarkInPortsInvalidSpec — node removal", () => {
  it("marks @ references invalid when a referenced node is removed", async () => {
    const inChiclet = `{${JSON.stringify({ type: "in", path: "removed-node", title: "@removed-node" })}}`;
    const config: NodeConfiguration = {
      config$prompt: {
        role: "user",
        parts: [{ text: `Use ${inChiclet}` }],
      },
    };

    const { context, appliedEdits } = createInvalidSpecContext(
      [
        { id: "remaining", configuration: config },
        {
          id: "removed-node",
          configuration: {
            config$prompt: { role: "user", parts: [{ text: "" }] },
          },
        },
      ],
      ""
    );

    const spec: EditSpec[] = [
      { type: "removenode", graphId: "", id: "removed-node" },
    ];
    const transform = new MarkInPortsInvalidSpec(spec);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1, "should mark @ references invalid");

    const text = promptTextFrom(configEdits[0]);
    assert.ok(text.includes('"invalid"'), "should include invalid flag");
  });
});

describe("MarkInPortsInvalidSpec — p-z- edge removal", () => {
  it("marks @ references invalid for p-z- edge removal", async () => {
    const inChiclet = `{${JSON.stringify({ type: "in", path: "source", title: "@source" })}}`;
    const config: NodeConfiguration = {
      config$prompt: {
        role: "user",
        parts: [{ text: `Use ${inChiclet}` }],
      },
    };

    const { context, appliedEdits } = createInvalidSpecContext(
      [
        {
          id: "source",
          configuration: {
            config$prompt: { role: "user", parts: [{ text: "" }] },
          },
        },
        { id: "dest", configuration: config },
      ],
      ""
    );

    const spec: EditSpec[] = [
      {
        type: "removeedge",
        graphId: "",
        edge: { from: "source", to: "dest", out: "output", in: "p-z-source" },
      },
    ];
    const transform = new MarkInPortsInvalidSpec(spec);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1, "should update config for @ reference");
  });
});

describe("MarkInPortsInvalidSpec — combined operations", () => {
  it("handles node removal + routing edge removal together", async () => {
    const inChiclet = `{${JSON.stringify({ type: "in", path: "deleted-node", title: "@deleted" })}}`;
    const routeChiclet = `{${JSON.stringify({ type: "tool", path: "control-flow/routing", instance: "route-target", title: "Route" })}}`;
    const config: NodeConfiguration = {
      config$prompt: {
        role: "user",
        parts: [{ text: `${inChiclet} ${routeChiclet}` }],
      },
    };

    const { context, appliedEdits } = createInvalidSpecContext(
      [
        { id: "source", configuration: config },
        {
          id: "deleted-node",
          configuration: {
            config$prompt: { role: "user", parts: [{ text: "" }] },
          },
        },
        {
          id: "route-target",
          configuration: {
            config$prompt: { role: "user", parts: [{ text: "" }] },
          },
        },
      ],
      ""
    );

    const spec: EditSpec[] = [
      { type: "removenode", graphId: "", id: "deleted-node" },
      routingEdge("source", "route-target"),
    ];
    const transform = new MarkInPortsInvalidSpec(spec);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.ok(appliedEdits.length >= 2, "should process both removal types");
  });

  it("passes through when spec has no removals", async () => {
    const { context, appliedEdits } = createInvalidSpecContext([], "");

    const spec: EditSpec[] = [
      { type: "addnode", graphId: "", node: { id: "new", type: "test" } },
    ];
    const transform = new MarkInPortsInvalidSpec(spec);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1, "just the spec pass");
  });
});
