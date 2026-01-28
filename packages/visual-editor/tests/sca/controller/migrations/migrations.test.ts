/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Migrations from "../../../../src/sca/controller/migration/migrations.js";
import { RecentBoardsController } from "../../../../src/sca/controller/subcontrollers/home/recent-boards-controller.js";
import { RecentBoardStore } from "../../../../src/data/recent-boards.js";
import { IdbFlagManager } from "../../../../src/idb/flags/idb-flag-manager.js";
import { defaultRuntimeFlags } from "../data/default-flags.js";
import { FlagController } from "../../../../src/sca/controller/subcontrollers/global/global.js";

suite("Migrations", () => {
  test("recentBoardsMigration", async () => {
    // TEST 1: Put something in the old store and migrate it.
    const boards = [
      { url: "http://localhost/board-1" },
      { url: "http://localhost/board-2" },
    ];
    const oldStore = RecentBoardStore.__instance();
    await oldStore.restore();

    // They should end up in recency order, i.e., [board-2, board-1].
    oldStore.add(boards[0]);
    oldStore.add(boards[1]);

    const recent = new RecentBoardsController("RecentBoard_Migration");
    await recent.isHydrated;

    await Migrations.recentBoardsMigration(recent);

    // After migration the order should be the same as above.
    await recent.isSettled;
    assert.equal(recent.boards.length, 2);
    assert.strictEqual(recent.boards[0].url, boards[1].url);

    // TEST 2: Check for double migration.
    await Migrations.recentBoardsMigration(recent);

    await recent.isSettled;
    assert.equal(recent.boards.length, 2);
    assert.strictEqual(recent.boards[0].url, boards[1].url);

    // TEST 3: Migrate over the top of an already-migrated Controller.
    // This time we have already got something in the RecentBoardsController and
    // so we avoid migrating over the top.
    const recent2 = new RecentBoardsController("RecentBoard_Migration_2");
    await recent2.isHydrated;

    // Add a board directly.
    recent2.add(boards[0]);
    await recent2.isSettled;

    // Clear the old store with nothing in it and attempt a migration.
    await oldStore.clear();
    await Migrations.recentBoardsMigration(recent2);

    await recent2.isSettled;
    assert.equal(recent2.boards.length, 1);
    assert.strictEqual(recent2.boards[0].url, boards[0].url);
  });

  test("flagsMigration", async () => {
    // TEST 1: Put something in the old store and migrate it.
    const oldStore = new IdbFlagManager(defaultRuntimeFlags);
    await oldStore.override("agentMode", true);
    await oldStore.override("consistentUI", true);

    const flagController = new FlagController(
      "Flag_Migration",
      defaultRuntimeFlags
    );
    await flagController.isHydrated;

    await Migrations.flagsMigration(flagController, defaultRuntimeFlags);
    await flagController.isSettled;

    let overrides = await flagController.overrides();
    assert.deepStrictEqual(overrides, {
      agentMode: true,
      consistentUI: true,
    });

    // TEST 2: Check for double migration.
    // Reset a value; this should not be carried forward.
    await oldStore.override("agentMode", false);
    await Migrations.flagsMigration(flagController, defaultRuntimeFlags);
    await flagController.isSettled;

    overrides = await flagController.overrides();
    assert.deepStrictEqual(overrides, {
      agentMode: true,
      consistentUI: true,
    });
  });
});
