/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  IntegrationManagerService,
  IntegrationManager,
  fromMcpTool,
} from "../../../src/sca/services/integration-managers.js";
import type { McpListToolResult } from "../../../src/mcp/index.js";
import type { Integration, Outcome } from "@breadboard-ai/types";
import type { McpClientManager, McpClient } from "../../../src/mcp/index.js";

/**
 * Creates a mock client factory for testing.
 */
function createMockClientFactory(options?: {
  failConnect?: boolean;
  tools?: McpListToolResult["tools"];
}): McpClientManager {
  const tools = options?.tools ?? [];
  return {
    async createClient() {
      if (options?.failConnect) {
        return { $error: "Connection failed" } as Outcome<McpClient>;
      }
      return {
        listTools: async () => ({ tools }),
      } as unknown as McpClient;
    },
  } as unknown as McpClientManager;
}

function createMockIntegration(overrides?: Partial<Integration>): Integration {
  return {
    title: "Test MCP Server",
    url: "https://example.com/mcp",
    ...overrides,
  } as Integration;
}

suite("fromMcpTool", () => {
  test("maps MCP tool to internal Tool format", () => {
    const tool: McpListToolResult["tools"][0] = {
      name: "test-tool",
      description: "A test tool",
      inputSchema: { type: "object" as const },
    };
    const result = fromMcpTool("https://example.com", tool);

    assert.strictEqual(result.url, "https://example.com");
    assert.strictEqual(result.title, "test-tool");
    assert.strictEqual(result.description, "A test tool");
    assert.strictEqual(result.icon, "robot_server");
    assert.strictEqual(result.id, "test-tool");
    assert.strictEqual(result.order, Number.MAX_SAFE_INTEGER);
    assert.deepStrictEqual(result.tags, []);
  });

  test("uses title if available, falls back to name", () => {
    const toolWithTitle = {
      name: "tool-id",
      title: "Pretty Title",
      description: "desc",
      inputSchema: { type: "object" as const },
    } as McpListToolResult["tools"][0];

    const result = fromMcpTool("https://example.com", toolWithTitle);
    assert.strictEqual(result.title, "Pretty Title");
  });

  test("uses name when title is not available", () => {
    const toolNoTitle = {
      name: "fallback-name",
      description: "desc",
      inputSchema: { type: "object" as const },
    } as McpListToolResult["tools"][0];

    const result = fromMcpTool("https://example.com", toolNoTitle);
    assert.strictEqual(result.title, "fallback-name");
  });
});

suite("IntegrationManagerService", () => {
  test("getOrCreate creates a new manager", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();
    const integration = createMockIntegration();

    const mgr = service.getOrCreate("key-1", integration, factory, () => {});

    assert.ok(mgr instanceof IntegrationManager);
    assert.ok(service.has("key-1"));
    assert.strictEqual(service.get("key-1"), mgr);
  });

  test("getOrCreate returns existing manager and updates it", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    const mgr1 = service.getOrCreate(
      "key-1",
      createMockIntegration({ title: "Original" }),
      factory,
      () => {}
    );
    const mgr2 = service.getOrCreate(
      "key-1",
      createMockIntegration({ title: "Updated" }),
      factory,
      () => {}
    );

    assert.strictEqual(mgr1, mgr2, "should return same instance");
    assert.strictEqual(mgr1.title, "Updated");
  });

  test("delete removes a manager", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    service.getOrCreate("key-1", createMockIntegration(), factory, () => {});
    assert.ok(service.has("key-1"));

    service.delete("key-1");
    assert.ok(!service.has("key-1"));
    assert.strictEqual(service.get("key-1"), undefined);
  });

  test("clear removes all managers", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    service.getOrCreate("a", createMockIntegration(), factory, () => {});
    service.getOrCreate("b", createMockIntegration(), factory, () => {});

    service.clear();
    assert.ok(!service.has("a"));
    assert.ok(!service.has("b"));
  });

  test("keys() returns iterator of manager keys", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    service.getOrCreate("a", createMockIntegration(), factory, () => {});
    service.getOrCreate("b", createMockIntegration(), factory, () => {});

    const keys = [...service.keys()];
    assert.deepStrictEqual(keys.sort(), ["a", "b"]);
  });

  test("entries() returns iteratable entries", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    service.getOrCreate("x", createMockIntegration(), factory, () => {});

    const entries = [...service.entries()];
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0][0], "x");
    assert.ok(entries[0][1] instanceof IntegrationManager);
  });

  test("snapshots() returns state for all managers", () => {
    const service = new IntegrationManagerService();
    const factory = createMockClientFactory();

    service.getOrCreate(
      "srv-1",
      createMockIntegration({ title: "Server 1" }),
      factory,
      () => {}
    );

    const snapshots = service.snapshots();
    assert.strictEqual(snapshots.size, 1);

    const snap = snapshots.get("srv-1");
    assert.ok(snap);
    assert.strictEqual(snap.title, "Server 1");
    assert.strictEqual(snap.status, "loading");
  });
});

suite("IntegrationManager", () => {
  test("initializes with loading status", () => {
    const factory = createMockClientFactory();
    const mgr = new IntegrationManager(
      createMockIntegration({ title: "Test", url: "http://test" }),
      factory,
      () => {}
    );

    assert.strictEqual(mgr.title, "Test");
    assert.strictEqual(mgr.url, "http://test");
    assert.strictEqual(mgr.status, "loading");
  });

  test("loads tools on successful connection", async () => {
    const tools = [
      {
        name: "tool-a",
        description: "Tool A",
        inputSchema: { type: "object" as const },
      },
      {
        name: "tool-b",
        description: "Tool B",
        inputSchema: { type: "object" as const },
      },
    ] as McpListToolResult["tools"];

    let stateChanged = false;
    const factory = createMockClientFactory({ tools });
    const mgr = new IntegrationManager(createMockIntegration(), factory, () => {
      stateChanged = true;
    });

    // Wait for async #reload to complete
    await new Promise<void>((r) => setTimeout(r, 50));

    assert.strictEqual(mgr.status, "complete");
    assert.strictEqual(mgr.tools.size, 2);
    assert.ok(mgr.tools.has("tool-a"));
    assert.ok(stateChanged, "onStateChange should have been called");
  });

  test("sets error status on connection failure", async () => {
    let stateChanged = false;
    const factory = createMockClientFactory({ failConnect: true });
    const mgr = new IntegrationManager(createMockIntegration(), factory, () => {
      stateChanged = true;
    });

    await new Promise<void>((r) => setTimeout(r, 50));

    assert.strictEqual(mgr.status, "error");
    assert.strictEqual(mgr.message, "Unable to load MCP client");
    assert.ok(stateChanged);
  });

  test("sets error status on listTools failure", async () => {
    const factory = {
      async createClient() {
        return {
          listTools: async () => {
            throw new Error("list failed");
          },
        } as unknown as McpClient;
      },
    } as unknown as McpClientManager;

    const mgr = new IntegrationManager(
      createMockIntegration(),
      factory,
      () => {}
    );

    await new Promise<void>((r) => setTimeout(r, 50));

    assert.strictEqual(mgr.status, "error");
    assert.ok(mgr.message?.includes("list failed"));
  });

  test("update changes title and url", () => {
    const factory = createMockClientFactory();
    const mgr = new IntegrationManager(
      createMockIntegration({ title: "Old", url: "http://old" }),
      factory,
      () => {}
    );

    mgr.update(createMockIntegration({ title: "New", url: "http://new" }));

    assert.strictEqual(mgr.title, "New");
    assert.strictEqual(mgr.url, "http://new");
  });

  test("snapshot returns plain state object", () => {
    const factory = createMockClientFactory();
    const mgr = new IntegrationManager(
      createMockIntegration({ title: "Snap", url: "http://snap" }),
      factory,
      () => {}
    );

    const snap = mgr.snapshot();
    assert.strictEqual(snap.title, "Snap");
    assert.strictEqual(snap.url, "http://snap");
    assert.strictEqual(snap.status, "loading");
    assert.strictEqual(snap.message, null);
    assert.ok(snap.tools instanceof Map);
  });

  test("descriptor returns McpServerDescriptor", () => {
    const factory = createMockClientFactory();
    const mgr = new IntegrationManager(
      createMockIntegration({ title: "Desc", url: "http://desc" }),
      factory,
      () => {}
    );

    const desc = mgr.descriptor();
    assert.strictEqual(desc.title, "Desc");
    assert.strictEqual(desc.details.name, "Desc");
    assert.strictEqual(desc.details.url, "http://desc");
    assert.strictEqual(desc.registered, true);
    assert.strictEqual(desc.removable, true);
  });
});
