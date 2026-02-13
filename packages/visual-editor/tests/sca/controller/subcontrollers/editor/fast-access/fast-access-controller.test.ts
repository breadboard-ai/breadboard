/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { beforeEach, suite, test } from "node:test";
import { FastAccessController } from "../../../../../../src/sca/controller/subcontrollers/editor/fast-access/fast-access-controller.js";
import type {
  DisplayItem,
  FastAccessItem,
} from "../../../../../../src/sca/types.js";
import type { Tool } from "../../../../../../src/ui/state/types.js";
import type { IntegrationsController } from "../../../../../../src/sca/controller/subcontrollers/editor/integrations/integrations.js";
import { NOTEBOOKLM_TOOL_PATH } from "@breadboard-ai/utils";

suite("FastAccessController", () => {
  let controller: FastAccessController;

  const noOpts = {
    environmentName: undefined,
    enableNotebookLm: false,
    integrationsController: null,
  } as const;

  const noAgentTools = new Map<string, Tool>();

  // Helpers to create test items
  function makeTool(
    title: string,
    opts?: { tags?: string[] }
  ): FastAccessItem & { kind: "tool" } {
    return {
      kind: "tool",
      tool: {
        title,
        url: `https://example.com/${title.toLowerCase()}`,
        ...(opts?.tags ? { tags: opts.tags } : {}),
      },
    };
  }

  function makeAsset(
    path: string,
    title?: string
  ): FastAccessItem & { kind: "asset" } {
    return {
      kind: "asset",
      asset: {
        path,
        metadata: title ? { title } : undefined,
      },
    } as FastAccessItem & { kind: "asset" };
  }

  function makeComponent(
    title: string
  ): FastAccessItem & { kind: "component" } {
    return {
      kind: "component",
      component: {
        id: title.toLowerCase(),
        title,
        url: `https://example.com/${title.toLowerCase()}`,
      },
    } as FastAccessItem & { kind: "component" };
  }

  function makeRoute(title: string): FastAccessItem & { kind: "route" } {
    return {
      kind: "route",
      route: {
        title,
        id: `node-${title.toLowerCase()}`,
        nodeId: `node-${title.toLowerCase()}`,
        graphId: `graph-1`,
      },
    } as FastAccessItem & { kind: "route" };
  }

  beforeEach(async () => {
    controller = new FastAccessController(
      "Test_FastAccess",
      "FastAccessController"
    );
    await controller.isHydrated;
  });

  // =========================================================================
  // Mode-based visibility
  // =========================================================================

  test("returns empty when mode is null", () => {
    const items = controller.getDisplayItems(
      [makeTool("Foo")],
      noAgentTools,
      noOpts
    );
    assert.strictEqual(items.length, 0);
  });

  test("tools mode shows tools and components", () => {
    controller.fastAccessMode = "tools";
    const rawItems: FastAccessItem[] = [
      makeTool("MyTool"),
      makeAsset("photo.png", "Photo"),
      makeComponent("MyComponent"),
      makeRoute("MyRoute"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 2);
    const kinds = items.map((i) => i.kind);
    assert.ok(kinds.includes("tool"));
    assert.ok(kinds.includes("component"));
    assert.ok(!kinds.includes("asset"));
    assert.ok(!kinds.includes("route"));
  });

  test("browse mode shows assets, tools, and components", () => {
    controller.fastAccessMode = "browse";
    const rawItems: FastAccessItem[] = [
      makeTool("MyTool"),
      makeAsset("photo.png", "Photo"),
      makeComponent("MyComponent"),
      makeRoute("MyRoute"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 3);
    const kinds = items.map((i) => i.kind);
    assert.ok(kinds.includes("tool"));
    assert.ok(kinds.includes("asset"));
    assert.ok(kinds.includes("component"));
    assert.ok(!kinds.includes("route"));
  });

  test("route mode shows routes only", () => {
    controller.fastAccessMode = "route";
    const rawItems: FastAccessItem[] = [
      makeTool("MyTool"),
      makeAsset("photo.png", "Photo"),
      makeComponent("MyComponent"),
      makeRoute("MyRoute"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]!.kind, "route");
  });

  // =========================================================================
  // Text filter
  // =========================================================================

  test("text filter matches tool titles", () => {
    controller.fastAccessMode = "tools";
    controller.filter = "search";
    const rawItems: FastAccessItem[] = [
      makeTool("SearchTool"),
      makeTool("OtherTool"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]!.kind, "tool");
    if (items[0]!.kind === "tool") {
      assert.strictEqual(items[0]!.tool.title, "SearchTool");
    }
  });

  test("text filter matches asset titles", () => {
    controller.fastAccessMode = "browse";
    controller.filter = "photo";
    const rawItems: FastAccessItem[] = [
      makeAsset("img.png", "My Photo"),
      makeAsset("doc.pdf", "My Document"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 1);
  });

  test("text filter matches component titles", () => {
    controller.fastAccessMode = "browse";
    controller.filter = "special";
    const rawItems: FastAccessItem[] = [
      makeComponent("SpecialComponent"),
      makeComponent("RegularComponent"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 1);
  });

  test("text filter matches route titles", () => {
    controller.fastAccessMode = "route";
    controller.filter = "target";
    const rawItems: FastAccessItem[] = [
      makeRoute("TargetRoute"),
      makeRoute("OtherRoute"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 1);
  });

  test("text filter excludes splash asset", () => {
    controller.fastAccessMode = "browse";
    controller.filter = "splash";
    const rawItems: FastAccessItem[] = [makeAsset("@@splash", "Splash")];
    const items = controller.getDisplayItems(rawItems, noAgentTools, noOpts);
    assert.strictEqual(items.length, 0);
  });

  // =========================================================================
  // Environment tag filter
  // =========================================================================

  test("environment tag filter excludes tools tagged for other environments", () => {
    controller.fastAccessMode = "tools";
    const rawItems: FastAccessItem[] = [
      makeTool("ProdTool", { tags: ["environment-production"] }),
      makeTool("DevTool", { tags: ["environment-development"] }),
      makeTool("NoTagTool"),
    ];
    const items = controller.getDisplayItems(rawItems, noAgentTools, {
      environmentName: "production",
      enableNotebookLm: false,
      integrationsController: null,
    });
    assert.strictEqual(items.length, 2);
    const titles = items
      .filter((i): i is DisplayItem & { kind: "tool" } => i.kind === "tool")
      .map((i) => i.tool.title);
    assert.ok(titles.includes("ProdTool"));
    assert.ok(titles.includes("NoTagTool"));
  });

  // =========================================================================
  // Agent mode tools
  // =========================================================================

  test("agent mode tools are appended in browse mode", () => {
    controller.fastAccessMode = "browse";
    const agentTools = new Map<string, Tool>([
      ["routing-tool", { title: "Routing" } as Tool],
      ["memory-tool", { title: "Memory" } as Tool],
    ]);
    const items = controller.getDisplayItems([], agentTools, noOpts);
    assert.strictEqual(items.length, 2);
  });

  test("agent mode tools excluded in route mode", () => {
    controller.fastAccessMode = "route";
    const agentTools = new Map<string, Tool>([
      ["routing-tool", { title: "Routing" } as Tool],
    ]);
    const items = controller.getDisplayItems([], agentTools, noOpts);
    assert.strictEqual(items.length, 0);
  });

  test("NotebookLM tool excluded when flag is disabled", () => {
    controller.fastAccessMode = "tools";
    const agentTools = new Map<string, Tool>([
      [NOTEBOOKLM_TOOL_PATH, { title: "NotebookLM" } as Tool],
      ["other-tool", { title: "Other" } as Tool],
    ]);
    const items = controller.getDisplayItems([], agentTools, {
      ...noOpts,
      enableNotebookLm: false,
    });
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]!.kind, "tool");
    if (items[0]!.kind === "tool") {
      assert.strictEqual(items[0]!.tool.title, "Other");
    }
  });

  test("NotebookLM tool included when flag is enabled", () => {
    controller.fastAccessMode = "tools";
    const agentTools = new Map<string, Tool>([
      [NOTEBOOKLM_TOOL_PATH, { title: "NotebookLM" } as Tool],
    ]);
    const items = controller.getDisplayItems([], agentTools, {
      ...noOpts,
      enableNotebookLm: true,
    });
    assert.strictEqual(items.length, 1);
  });

  test("agent mode tools filtered by text filter", () => {
    controller.fastAccessMode = "tools";
    controller.filter = "memory";
    const agentTools = new Map<string, Tool>([
      ["routing-tool", { title: "Routing" } as Tool],
      ["memory-tool", { title: "Memory" } as Tool],
    ]);
    const items = controller.getDisplayItems([], agentTools, noOpts);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]!.kind, "tool");
    if (items[0]!.kind === "tool") {
      assert.strictEqual(items[0]!.tool.title, "Memory");
    }
  });

  // =========================================================================
  // Integration tools
  // =========================================================================

  test("integration tools are appended when present", () => {
    controller.fastAccessMode = "tools";
    const integrationsController = {
      registered: new Map([
        [
          "https://integration.example.com",
          {
            status: "complete" as const,
            tools: new Map([["tool-1", { title: "IntegrationTool" } as Tool]]),
          },
        ],
      ]),
    } as unknown as IntegrationsController;
    const items = controller.getDisplayItems([], noAgentTools, {
      ...noOpts,
      integrationsController,
    });
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0]!.kind, "integration-tool");
  });

  test("integration tools filtered by text filter", () => {
    controller.fastAccessMode = "tools";
    controller.filter = "special";
    const integrationsController = {
      registered: new Map([
        [
          "https://integration.example.com",
          {
            status: "complete" as const,
            tools: new Map([
              ["tool-1", { title: "SpecialIntegration" } as Tool],
              ["tool-2", { title: "OtherIntegration" } as Tool],
            ]),
          },
        ],
      ]),
    } as unknown as IntegrationsController;
    const items = controller.getDisplayItems([], noAgentTools, {
      ...noOpts,
      integrationsController,
    });
    assert.strictEqual(items.length, 1);
  });

  test("incomplete integrations are skipped", () => {
    controller.fastAccessMode = "tools";
    const integrationsController = {
      registered: new Map([
        [
          "https://integration.example.com",
          {
            status: "pending" as const,
            tools: new Map([["tool-1", { title: "PendingTool" } as Tool]]),
          },
        ],
      ]),
    } as unknown as IntegrationsController;
    const items = controller.getDisplayItems([], noAgentTools, {
      ...noOpts,
      integrationsController,
    });
    assert.strictEqual(items.length, 0);
  });
});
