/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import type { EditHistoryEntry } from "@breadboard-ai/types";
import { BoardController } from "../../../../../src/sca/controller/subcontrollers/board/board-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("BoardController version history", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("starts with empty version history", async () => {
    const controller = new BoardController("BoardTest_1");
    await controller.isHydrated;

    assert.strictEqual(controller.getLastSeenVersion("https://example.com/board.json"), -1);
  });

  test("records and retrieves version", async () => {
    const controller = new BoardController("BoardTest_2");
    await controller.isHydrated;

    controller.recordVersion("https://example.com/board.json", 42);
    await controller.isSettled;

    assert.strictEqual(controller.getLastSeenVersion("https://example.com/board.json"), 42);
  });

  test("tracks multiple URLs independently", async () => {
    const controller = new BoardController("BoardTest_3");
    await controller.isHydrated;

    controller.recordVersion("https://example.com/board1.json", 10);
    controller.recordVersion("https://example.com/board2.json", 20);
    await controller.isSettled;

    assert.strictEqual(controller.getLastSeenVersion("https://example.com/board1.json"), 10);
    assert.strictEqual(controller.getLastSeenVersion("https://example.com/board2.json"), 20);
    assert.strictEqual(controller.getLastSeenVersion("https://example.com/unknown.json"), -1);
  });

  test("newerVersionAvailable defaults to false", async () => {
    const controller = new BoardController("BoardTest_4");
    await controller.isHydrated;

    assert.strictEqual(controller.newerVersionAvailable, false);
  });

  test("can set newerVersionAvailable", async () => {
    const controller = new BoardController("BoardTest_5");
    await controller.isHydrated;

    controller.newerVersionAvailable = true;
    await controller.isSettled;

    assert.strictEqual(controller.newerVersionAvailable, true);
  });
});

suite("BoardController edit history", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("starts with empty edit history", async () => {
    const controller = new BoardController("BoardTest_EditHistory_1");
    await controller.isHydrated;

    const history = controller.getEditHistory("https://example.com/board.json");
    assert.deepStrictEqual(history, []);
  });

  test("saves and retrieves edit history", async () => {
    const controller = new BoardController("BoardTest_EditHistory_2");
    await controller.isHydrated;

    const mockHistory = [
      { timestamp: 1, graphId: "main", label: "Add node" },
      { timestamp: 2, graphId: "main", label: "Connect nodes" },
    ];

    controller.saveEditHistory(
      "https://example.com/board.json",
      mockHistory as unknown as EditHistoryEntry[]
    );
    await controller.isSettled;

    const retrieved = controller.getEditHistory("https://example.com/board.json");
    assert.strictEqual(retrieved.length, 2);
  });

  test("tracks edit history for multiple boards independently", async () => {
    const controller = new BoardController("BoardTest_EditHistory_3");
    await controller.isHydrated;

    const history1 = [{ timestamp: 1, graphId: "main", label: "Edit 1" }];
    const history2 = [{ timestamp: 2, graphId: "main", label: "Edit 2" }];

    controller.saveEditHistory(
      "https://example.com/board1.json",
      history1 as unknown as EditHistoryEntry[]
    );
    controller.saveEditHistory(
      "https://example.com/board2.json",
      history2 as unknown as EditHistoryEntry[]
    );
    await controller.isSettled;

    const retrieved1 = controller.getEditHistory("https://example.com/board1.json");
    const retrieved2 = controller.getEditHistory("https://example.com/board2.json");
    const retrievedUnknown = controller.getEditHistory("https://example.com/unknown.json");

    assert.strictEqual(retrieved1.length, 1);
    assert.strictEqual(retrieved2.length, 1);
    assert.deepStrictEqual(retrievedUnknown, []);
  });

  test("saveEditHistory creates a copy of the array", async () => {
    const controller = new BoardController("BoardTest_EditHistory_4");
    await controller.isHydrated;

    const originalHistory = [{ timestamp: 1, graphId: "main", label: "Test" }];

    controller.saveEditHistory(
      "https://example.com/board.json",
      originalHistory as unknown as EditHistoryEntry[]
    );
    await controller.isSettled;

    // Modify the original array
    originalHistory.push({ timestamp: 2, graphId: "main", label: "New" });

    // Retrieved history should not be affected
    const retrieved = controller.getEditHistory("https://example.com/board.json");
    assert.strictEqual(retrieved.length, 1);
  });
});
