/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { IntegrationsController } from "../../../../../../src/sca/controller/subcontrollers/editor/integrations/integrations-controller.js";
import type { IntegrationState } from "../../../../../../src/ui/state/types.js";

suite("IntegrationsController", () => {
  // ---------------------------------------------------------------------------
  // registered
  // ---------------------------------------------------------------------------

  test("registered starts empty", async () => {
    const ctrl = new IntegrationsController("IC_1", "test");
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.registered.size, 0);
  });

  test("setRegistered updates the registered map", async () => {
    const ctrl = new IntegrationsController("IC_2", "test");
    await ctrl.isHydrated;

    const state: IntegrationState = {
      title: "Test Server",
      url: "https://example.com/mcp",
      status: "complete",
      message: null,
      tools: new Map(),
    };

    ctrl.setRegistered(new Map([["https://example.com/mcp", state]]));
    await ctrl.isSettled;

    assert.strictEqual(ctrl.registered.size, 1);
    assert.strictEqual(
      ctrl.registered.get("https://example.com/mcp")?.title,
      "Test Server"
    );
  });

  // ---------------------------------------------------------------------------
  // known + knownStatus
  // ---------------------------------------------------------------------------

  test("knownStatus starts as pending", async () => {
    const ctrl = new IntegrationsController("IC_3", "test");
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.knownStatus, "pending");
    assert.strictEqual(ctrl.known.size, 0);
  });

  test("setKnown updates known map and sets status to complete", async () => {
    const ctrl = new IntegrationsController("IC_4", "test");
    await ctrl.isHydrated;

    const known = new Map([
      [
        "https://built-in.com",
        {
          title: "Built-in",
          details: {
            name: "Built-in",
            version: "0.0.1",
            url: "https://built-in.com",
          },
          registered: false,
          removable: false,
        },
      ],
    ]);

    ctrl.setKnown(known);
    await ctrl.isSettled;

    assert.strictEqual(ctrl.knownStatus, "complete");
    assert.strictEqual(ctrl.known.size, 1);
    assert.strictEqual(
      ctrl.known.get("https://built-in.com")?.title,
      "Built-in"
    );
  });

  test("setKnownError sets status to error", async () => {
    const ctrl = new IntegrationsController("IC_5", "test");
    await ctrl.isHydrated;

    ctrl.setKnownError();
    await ctrl.isSettled;

    assert.strictEqual(ctrl.knownStatus, "error");
  });

  // ---------------------------------------------------------------------------
  // storedServers
  // ---------------------------------------------------------------------------

  test("storedServers starts empty", async () => {
    const ctrl = new IntegrationsController("IC_6", "test");
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.storedServers.size, 0);
  });

  test("setStoredServers updates the stored servers map", async () => {
    const ctrl = new IntegrationsController("IC_7", "test");
    await ctrl.isHydrated;

    const servers = new Map([
      [
        "https://user-server.com",
        { url: "https://user-server.com", title: "My Server" },
      ],
    ]);
    ctrl.setStoredServers(servers);
    await ctrl.isSettled;

    assert.strictEqual(ctrl.storedServers.size, 1);
    assert.strictEqual(
      ctrl.storedServers.get("https://user-server.com")?.title,
      "My Server"
    );
  });

  // ---------------------------------------------------------------------------
  // resetAll
  // ---------------------------------------------------------------------------

  test("resetAll clears registered and known but not storedServers", async () => {
    const ctrl = new IntegrationsController("IC_8", "test");
    await ctrl.isHydrated;

    // Populate all state.
    ctrl.setRegistered(
      new Map([
        [
          "https://reg.com",
          {
            title: "Reg",
            url: "https://reg.com",
            status: "complete" as const,
            message: null,
            tools: new Map(),
          },
        ],
      ])
    );
    ctrl.setKnown(
      new Map([
        [
          "https://known.com",
          {
            title: "Known",
            details: {
              name: "Known",
              version: "0.0.1",
              url: "https://known.com",
            },
            registered: false,
            removable: true,
          },
        ],
      ])
    );
    ctrl.setStoredServers(
      new Map([
        ["https://stored.com", { url: "https://stored.com", title: "Stored" }],
      ])
    );
    await ctrl.isSettled;

    ctrl.resetAll();
    await ctrl.isSettled;

    assert.strictEqual(ctrl.registered.size, 0, "registered should be empty");
    assert.strictEqual(ctrl.known.size, 0, "known should be empty");
    assert.strictEqual(
      ctrl.knownStatus,
      "pending",
      "knownStatus should reset to pending"
    );
    assert.strictEqual(
      ctrl.storedServers.size,
      1,
      "storedServers should NOT be cleared"
    );
  });

  // ---------------------------------------------------------------------------
  // migration
  // ---------------------------------------------------------------------------

  test("migrate sets stored servers and marks as migrated", async () => {
    const ctrl = new IntegrationsController("IC_9", "test");
    await ctrl.isHydrated;

    assert.strictEqual(ctrl.isMigrated, false);

    const servers = new Map([
      ["https://legacy.com", { url: "https://legacy.com", title: "Legacy" }],
    ]);
    ctrl.migrate(servers);
    await ctrl.isSettled;

    assert.strictEqual(ctrl.isMigrated, true);
    assert.strictEqual(ctrl.storedServers.size, 1);
    assert.strictEqual(
      ctrl.storedServers.get("https://legacy.com")?.title,
      "Legacy"
    );
  });

  test("migrate is a no-op when already migrated", async () => {
    const ctrl = new IntegrationsController("IC_10", "test");
    await ctrl.isHydrated;

    ctrl.migrate(
      new Map([
        ["https://first.com", { url: "https://first.com", title: "First" }],
      ])
    );
    await ctrl.isSettled;

    // Second call should be ignored.
    ctrl.migrate(
      new Map([
        ["https://second.com", { url: "https://second.com", title: "Second" }],
      ])
    );
    await ctrl.isSettled;

    assert.strictEqual(ctrl.storedServers.size, 1);
    assert.ok(ctrl.storedServers.has("https://first.com"));
    assert.ok(!ctrl.storedServers.has("https://second.com"));
  });

  test("migrate with empty map marks migrated but does not overwrite storedServers", async () => {
    const ctrl = new IntegrationsController("IC_11", "test");
    await ctrl.isHydrated;

    // Pre-populate stored servers.
    ctrl.setStoredServers(
      new Map([
        [
          "https://existing.com",
          { url: "https://existing.com", title: "Existing" },
        ],
      ])
    );
    await ctrl.isSettled;

    ctrl.migrate(new Map());
    await ctrl.isSettled;

    assert.strictEqual(ctrl.isMigrated, true);
    assert.strictEqual(
      ctrl.storedServers.size,
      1,
      "Empty migration should not clear existing servers"
    );
  });
});
