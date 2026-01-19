/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { RecentBoardsController } from "../../../../src/controller/subcontrollers/home/recent-boards-controller.js";

suite("RecentBoardsController", () => {
  test("Basics", async () => {
    const store = new RecentBoardsController("Recent_1");
    await store.isHydrated;

    assert.strictEqual(store.boards.length, 0);
  });

  test("Adding URLs", async () => {
    const store = new RecentBoardsController("Recent_2");
    await store.isHydrated;

    const boards = [
      { url: "http://localhost/board-1", title: "Board 1" },
      { url: "http://localhost/board-2", title: "Board 2" },
    ];

    store.add(boards[0]);
    store.add(boards[1]);
    await store.isSettled;

    // The boards should be reordered to put board-2 before board-1.
    assert.deepStrictEqual(store.boards[0], boards[1]);

    // And now they should be switched back.
    store.add(boards[0]);
    await store.isSettled;
    assert.deepStrictEqual(store.boards[0], boards[0]);
  });

  test("Removing URLs", async () => {
    const store = new RecentBoardsController("Recent_2");
    await store.isHydrated;

    const boards = [
      { url: "http://localhost/board-1", title: "Board 1" },
      { url: "http://localhost/board-2", title: "Board 2" },
    ];

    store.add(boards[0]);
    store.add(boards[1]);
    await store.isSettled;

    // The boards should be reordered to put board-2 before board-1.
    assert.deepStrictEqual(store.boards[0], boards[1]);

    // And now they should be switched back.
    store.remove(boards[1].url);
    await store.isSettled;
    assert.strictEqual(store.boards.length, 1);
    assert.deepStrictEqual(store.boards[0], boards[0]);

    // Non-existent item.
    store.remove("foo");
    await store.isSettled;
    assert.strictEqual(store.boards.length, 1);
    assert.deepStrictEqual(store.boards[0], boards[0]);
  });

  test("Truncates storage", async () => {
    const store = new RecentBoardsController("Recent_3", 1);
    await store.isHydrated;

    const boards = [
      { url: "http://localhost/board-1", title: "Board 1" },
      { url: "http://localhost/board-2", title: "Board 2" },
    ];

    store.add(boards[0]);
    store.add(boards[1]);
    await store.isSettled;

    // The boards should be truncated.
    assert.deepStrictEqual(store.boards.length, 1);
    assert.deepStrictEqual(store.boards[0], boards[1]);
  });

  test("Pins items", async () => {
    const store = new RecentBoardsController("Recent_4");
    await store.isHydrated;

    const boards = [
      { url: "http://localhost/board-1", title: "Board 1" },
      { url: "http://localhost/board-2", title: "Board 2" },
    ];

    // Add the boards. Note that they will be added in reverse order so we
    // should set the pinned value on board-2 it will be in position 0 of
    // store.boards when we got to check the pinned value.
    store.add(boards[0]);
    store.add(boards[1]);
    await store.isSettled;

    // Pinned.
    store.setPin(boards[1].url, true);
    await store.isSettled;
    assert.strictEqual(store.boards[0].pinned, true);

    // Unpinned.
    store.setPin(boards[1].url, false);
    await store.isSettled;
    assert.strictEqual(store.boards[0].pinned, false);

    // Non-existent pin.
    assert.doesNotThrow(() => {
      store.setPin("foo", false);
    });
    await store.isSettled;
  });
});
