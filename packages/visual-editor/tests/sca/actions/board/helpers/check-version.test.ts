/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { checkVersion } from "../../../../../src/sca/actions/board/helpers/check-version.js";
import { BoardController } from "../../../../../src/sca/controller/subcontrollers/board/board-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import type { BoardServer } from "@breadboard-ai/types";

suite("check-version helpers", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("returns null for graphs owned by user", async () => {
    const controller = new BoardController("CheckVersionTest_1");
    await controller.isHydrated;

    const mockBoardServer = {
      getLatestSharedVersion: () => 5,
    } as unknown as BoardServer;

    const result = await checkVersion(
      "https://example.com/board.json",
      mockBoardServer,
      controller,
      { isMine: () => true }
    );

    assert.strictEqual(result, null);
  });

  test("returns null when no URL provided", async () => {
    const controller = new BoardController("CheckVersionTest_2");
    await controller.isHydrated;

    const mockBoardServer = {
      getLatestSharedVersion: () => 5,
    } as unknown as BoardServer;

    const result = await checkVersion(undefined, mockBoardServer, controller, {
      isMine: () => false,
    });

    assert.strictEqual(result, null);
  });

  test("returns null when board server is null", async () => {
    const controller = new BoardController("CheckVersionTest_3");
    await controller.isHydrated;

    const result = await checkVersion(
      "https://example.com/board.json",
      null,
      controller,
      { isMine: () => false }
    );

    assert.strictEqual(result, null);
  });

  test("returns null when board server lacks getLatestSharedVersion", async () => {
    const controller = new BoardController("CheckVersionTest_4");
    await controller.isHydrated;

    const mockBoardServer = {} as unknown as BoardServer;

    const result = await checkVersion(
      "https://example.com/board.json",
      mockBoardServer,
      controller,
      { isMine: () => false }
    );

    assert.strictEqual(result, null);
  });

  test("returns version info for shared graph (first load)", async () => {
    const controller = new BoardController("CheckVersionTest_5");
    await controller.isHydrated;

    const mockBoardServer = {
      getLatestSharedVersion: () => 10,
    } as unknown as BoardServer;

    const result = await checkVersion(
      "https://example.com/board.json",
      mockBoardServer,
      controller,
      { isMine: () => false }
    );

    assert.ok(result);
    assert.strictEqual(result.version, 10);
    assert.strictEqual(result.lastLoadedVersion, -1); // First load
    assert.strictEqual(result.isNewer, false); // First load, no previous version
  });

  test("detects newer version when version increases", async () => {
    const controller = new BoardController("CheckVersionTest_6");
    await controller.isHydrated;

    const url = "https://example.com/board.json";

    // First call - record version 5
    const mockBoardServer5 = {
      getLatestSharedVersion: () => 5,
    } as unknown as BoardServer;

    await checkVersion(url, mockBoardServer5, controller, {
      isMine: () => false,
    });
    await controller.isSettled;

    // Second call - version increased to 10
    const mockBoardServer10 = {
      getLatestSharedVersion: () => 10,
    } as unknown as BoardServer;

    const result = await checkVersion(url, mockBoardServer10, controller, {
      isMine: () => false,
    });

    assert.ok(result);
    assert.strictEqual(result.version, 10);
    assert.strictEqual(result.lastLoadedVersion, 5);
    assert.strictEqual(result.isNewer, true);
  });
});
