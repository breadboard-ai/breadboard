/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
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
