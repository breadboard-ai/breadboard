/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Integration from "../../../../src/sca/actions/integration/integration-actions.js";
import { makeTestGraphStoreWithEditor } from "../../helpers/index.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { IntegrationState } from "../../../../src/ui/types/state-types.js";
import { IntegrationManagerService } from "../../../../src/sca/services/integration-managers.js";
import { ok } from "@breadboard-ai/utils";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a minimal mock bind context for integration action tests.
 */
function createBind(overrides: {
  registered?: Map<string, IntegrationState>;
  known?: Map<
    string,
    {
      title: string;
      details: {
        url: string;
        name: string;
        version: string;
        authToken?: string;
      };
      registered: boolean;
      removable: boolean;
    }
  >;
  knownStatus?: "pending" | "complete" | "error";
  storedServers?: Map<
    string,
    { url: string; title: string; authToken?: string }
  >;
  editor?: unknown;
  graph?: unknown;
  builtInServers?: Array<{ url: string; title: string; description?: string }>;
  integrationManagers?: IntegrationManagerService;
}) {
  const registered = overrides.registered ?? new Map();
  const known = overrides.known ?? new Map();
  let storedServers = overrides.storedServers ?? new Map();
  let knownStatus = overrides.knownStatus ?? "complete";
  let knownResult = new Map(known);

  const integrationsController = {
    get registered() {
      return registered;
    },
    setRegistered(map: Map<string, IntegrationState>) {
      registered.clear();
      for (const [k, v] of map) registered.set(k, v);
    },
    get known() {
      return knownResult;
    },
    get knownStatus() {
      return knownStatus;
    },
    setKnown(map: Map<string, unknown>) {
      knownResult = map as typeof knownResult;
      knownStatus = "complete";
    },
    setKnownError() {
      knownStatus = "error";
    },
    get storedServers() {
      return storedServers;
    },
    setStoredServers(
      map: Map<string, { url: string; title: string; authToken?: string }>
    ) {
      storedServers = map;
    },
    resetAll() {
      registered.clear();
      knownResult = new Map();
      knownStatus = "pending";
    },
  };

  const controller = {
    editor: {
      integrations: integrationsController,
      graph: {
        graph: overrides.graph ?? null,
        editor: overrides.editor ?? null,
        version: 0,
      },
    },
  } as unknown as AppController;

  const services = {
    mcpClientManager: {
      builtInServers: () => overrides.builtInServers ?? [],
    },
    integrationManagers:
      overrides.integrationManagers ?? new IntegrationManagerService(),
  } as unknown as AppServices;

  return { controller, services, integrationsController };
}

// =============================================================================
// Tests
// =============================================================================

suite("Integration Actions", () => {
  // ---------------------------------------------------------------------------
  // syncFromGraph
  // ---------------------------------------------------------------------------

  suite("syncFromGraph", () => {
    test("clears state when no graph is loaded", async () => {
      const managers = new IntegrationManagerService();
      const { controller, services } = createBind({
        graph: null,
        integrationManagers: managers,
      });

      Integration.bind({ controller, services });
      await Integration.syncFromGraph();

      assert.strictEqual(
        controller.editor.integrations.registered.size,
        0,
        "registered should be empty"
      );
    });

    test("creates managers from graph integrations", async () => {
      const managers = new IntegrationManagerService();
      const registered = new Map<string, IntegrationState>();
      const graph = {
        nodes: [],
        edges: [],
        integrations: {
          "https://mcp.example.com": {
            title: "Test MCP",
            url: "https://mcp.example.com",
          },
        },
      };

      // Mock clientFactory that resolves with a client that lists tools.
      const mockClientManager = {
        builtInServers: () => [],
        createClient: async () => ({
          listTools: async () => ({ tools: [] }),
        }),
      };

      const { controller, services } = createBind({
        graph,
        integrationManagers: managers,
        registered,
      });
      // Override the mcpClientManager with our mock.
      (services as unknown as Record<string, unknown>).mcpClientManager =
        mockClientManager;

      Integration.bind({ controller, services });
      await Integration.syncFromGraph();

      // Manager should have been created.
      assert.ok(
        managers.has("https://mcp.example.com"),
        "Manager should exist"
      );

      // Registered map should have an entry.
      assert.strictEqual(registered.size, 1);
    });

    test("removes stale managers when integrations disappear from graph", async () => {
      const managers = new IntegrationManagerService();

      // First sync with integration present.
      const graph = {
        nodes: [],
        edges: [],
        integrations: {
          "https://mcp-a.example.com": {
            title: "A",
            url: "https://mcp-a.example.com",
          },
        },
      };
      const registered = new Map<string, IntegrationState>();
      const mockClientManager = {
        builtInServers: () => [],
        createClient: async () => ({
          listTools: async () => ({ tools: [] }),
        }),
      };

      const { controller, services } = createBind({
        graph,
        integrationManagers: managers,
        registered,
      });
      (services as unknown as Record<string, unknown>).mcpClientManager =
        mockClientManager;

      Integration.bind({ controller, services });
      await Integration.syncFromGraph();

      assert.ok(managers.has("https://mcp-a.example.com"));

      // Now update graph to remove the integration.
      (controller.editor.graph as unknown as Record<string, unknown>).graph = {
        nodes: [],
        edges: [],
        integrations: {},
      };

      await Integration.syncFromGraph();

      assert.ok(
        !managers.has("https://mcp-a.example.com"),
        "Stale manager should be removed"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refreshKnown
  // ---------------------------------------------------------------------------

  suite("refreshKnown", () => {
    test("merges built-in, stored, and registered servers", async () => {
      const registered = new Map<string, IntegrationState>();
      const storedServers = new Map([
        [
          "https://user.example.com",
          { url: "https://user.example.com", title: "User Server" },
        ],
      ]);

      const { controller, services } = createBind({
        registered,
        storedServers,
        builtInServers: [
          { url: "https://builtin.example.com", title: "Built-in" },
        ],
      });

      Integration.bind({ controller, services });
      await Integration.refreshKnown();

      const known = controller.editor.integrations.known;
      assert.ok(
        known.has("https://builtin.example.com"),
        "Built-in should be present"
      );
      assert.ok(
        known.has("https://user.example.com"),
        "Stored should be present"
      );

      const builtIn = known.get("https://builtin.example.com");
      assert.strictEqual(
        builtIn?.removable,
        false,
        "Built-in should not be removable"
      );

      const user = known.get("https://user.example.com");
      assert.strictEqual(user?.registered, false, "Not registered yet");
    });

    test("marks status as complete after refresh", async () => {
      const { controller, services, integrationsController } = createBind({
        knownStatus: "pending",
      });

      Integration.bind({ controller, services });
      await Integration.refreshKnown();

      assert.strictEqual(integrationsController.knownStatus, "complete");
    });
  });

  // ---------------------------------------------------------------------------
  // register
  // ---------------------------------------------------------------------------

  suite("register", () => {
    test("returns error when known list is not available", async () => {
      const { controller, services } = createBind({ knownStatus: "pending" });
      Integration.bind({ controller, services });

      const result = await Integration.register("https://example.com");
      assert.ok(result !== undefined && !ok(result), "Should return error");
    });

    test("returns error when server is unknown", async () => {
      const { controller, services } = createBind({ knownStatus: "complete" });
      Integration.bind({ controller, services });

      const result = await Integration.register("https://unknown.example.com");
      assert.ok(result !== undefined && !ok(result), "Should return error");
    });

    test("returns error when server is already registered", async () => {
      const known = new Map([
        [
          "https://reg.example.com",
          {
            title: "Reg",
            details: {
              url: "https://reg.example.com",
              name: "Reg",
              version: "0.0.1",
            },
            registered: true,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({ known });
      Integration.bind({ controller, services });

      const result = await Integration.register("https://reg.example.com");
      assert.ok(result !== undefined && !ok(result), "Should return error");
    });

    test("registers a known server successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const known = new Map([
        [
          "https://new.example.com",
          {
            title: "New Server",
            details: {
              url: "https://new.example.com",
              name: "New Server",
              version: "0.0.1",
            },
            registered: false,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({
        known,
        editor,
      });
      Integration.bind({ controller, services });

      const result = await Integration.register("https://new.example.com");
      assert.ok(
        result === undefined || ok(result),
        "Should succeed without error"
      );
    });

    test("returns error when no editor is available", async () => {
      const known = new Map([
        [
          "https://no-editor.example.com",
          {
            title: "No Editor",
            details: {
              url: "https://no-editor.example.com",
              name: "No Editor",
              version: "0.0.1",
            },
            registered: false,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({ known, editor: null });
      Integration.bind({ controller, services });

      const result = await Integration.register(
        "https://no-editor.example.com"
      );
      assert.ok(result !== undefined && !ok(result), "Should return error");
    });
  });

  // ---------------------------------------------------------------------------
  // unregister
  // ---------------------------------------------------------------------------

  suite("unregister", () => {
    test("returns error when known list is not available", async () => {
      const { controller, services } = createBind({ knownStatus: "pending" });
      Integration.bind({ controller, services });

      const result = await Integration.unregister("https://example.com");
      assert.ok(result !== undefined && !ok(result));
    });

    test("returns error when server is unknown", async () => {
      const { controller, services } = createBind({});
      Integration.bind({ controller, services });

      const result = await Integration.unregister(
        "https://unknown.example.com"
      );
      assert.ok(result !== undefined && !ok(result));
    });

    test("returns error when server is already unregistered", async () => {
      const known = new Map([
        [
          "https://unreg.example.com",
          {
            title: "Unreg",
            details: {
              url: "https://unreg.example.com",
              name: "Unreg",
              version: "0.0.1",
            },
            registered: false,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({ known });
      Integration.bind({ controller, services });

      const result = await Integration.unregister("https://unreg.example.com");
      assert.ok(result !== undefined && !ok(result));
    });

    test("returns error when no editor is available", async () => {
      const known = new Map([
        [
          "https://no-editor.example.com",
          {
            title: "No Editor",
            details: {
              url: "https://no-editor.example.com",
              name: "No Editor",
              version: "0.0.1",
            },
            registered: true,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({ known, editor: null });
      Integration.bind({ controller, services });

      const result = await Integration.unregister(
        "https://no-editor.example.com"
      );
      assert.ok(result !== undefined && !ok(result));
    });

    test("unregisters a server successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();

      // First add an integration to the graph.
      await editor.edit(
        [
          {
            type: "upsertintegration",
            id: "https://to-remove.example.com",
            integration: {
              title: "To Remove",
              url: "https://to-remove.example.com",
            },
          },
        ],
        "Add integration"
      );

      const known = new Map([
        [
          "https://to-remove.example.com",
          {
            title: "To Remove",
            details: {
              url: "https://to-remove.example.com",
              name: "To Remove",
              version: "0.0.1",
            },
            registered: true,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({ known, editor });
      Integration.bind({ controller, services });

      const result = await Integration.unregister(
        "https://to-remove.example.com"
      );
      assert.ok(
        result === undefined || ok(result),
        "Should succeed without error"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------

  suite("add", () => {
    test("adds to stored servers and registers", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const storedServers = new Map<
        string,
        { url: string; title: string; authToken?: string }
      >();

      const { controller, services } = createBind({
        editor,
        storedServers,
      });
      Integration.bind({ controller, services });

      const result = await Integration.add(
        "https://new-mcp.example.com",
        "New MCP",
        "tok-123"
      );

      assert.ok(
        result === undefined || ok(result),
        "Should succeed without error"
      );

      // Check stored servers were updated.
      const stored = controller.editor.integrations.storedServers;
      assert.ok(stored.has("https://new-mcp.example.com"));
      assert.strictEqual(
        stored.get("https://new-mcp.example.com")?.authToken,
        "tok-123"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  suite("remove", () => {
    test("returns error when known list is not available", async () => {
      const { controller, services } = createBind({ knownStatus: "pending" });
      Integration.bind({ controller, services });

      const result = await Integration.remove("https://example.com");
      assert.ok(result !== undefined && !ok(result));
    });

    test("returns error when server is unknown", async () => {
      const { controller, services } = createBind({});
      Integration.bind({ controller, services });

      const result = await Integration.remove("https://unknown.example.com");
      assert.ok(result !== undefined && !ok(result));
    });

    test("removes from graph and stored servers", async () => {
      const { editor } = makeTestGraphStoreWithEditor();

      // Add integration to graph.
      await editor.edit(
        [
          {
            type: "upsertintegration",
            id: "https://removable.example.com",
            integration: {
              title: "Removable",
              url: "https://removable.example.com",
            },
          },
        ],
        "Add integration"
      );

      const storedServers = new Map([
        [
          "https://removable.example.com",
          { url: "https://removable.example.com", title: "Removable" },
        ],
      ]);
      const known = new Map([
        [
          "https://removable.example.com",
          {
            title: "Removable",
            details: {
              url: "https://removable.example.com",
              name: "Removable",
              version: "0.0.1",
            },
            registered: true,
            removable: true,
          },
        ],
      ]);

      const { controller, services } = createBind({
        known,
        editor,
        storedServers,
      });
      Integration.bind({ controller, services });

      const result = await Integration.remove("https://removable.example.com");
      assert.ok(
        result === undefined || ok(result),
        "Should succeed without error"
      );

      // Stored servers should be updated.
      const stored = controller.editor.integrations.storedServers;
      assert.ok(
        !stored.has("https://removable.example.com"),
        "Server should be removed from stored"
      );
    });
  });
});
