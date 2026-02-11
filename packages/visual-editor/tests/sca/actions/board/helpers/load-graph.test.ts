/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import {
  canLoad,
  loadGraph,
} from "../../../../../src/sca/actions/board/helpers/load-graph.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

suite("load-graph helpers", () => {
  suite("canLoad", () => {
    test("returns canLoad: true for valid URL", () => {
      const result = canLoad("https://example.com/board.json", null);
      assert.strictEqual(result.canLoad, true);
      if (result.canLoad) {
        assert.strictEqual(
          result.urlWithResourceKey,
          "https://example.com/board.json"
        );
      }
    });

    test("adds resourcekey from reference URL", () => {
      const result = canLoad(
        "https://example.com/board.json",
        "https://other.com/page?resourcekey=abc123"
      );
      assert.strictEqual(result.canLoad, true);
      if (result.canLoad) {
        assert.strictEqual(
          result.urlWithResourceKey,
          "https://example.com/board.json?resourcekey=abc123"
        );
      }
    });

    test("returns canLoad: false for invalid URL", () => {
      // Empty string with no base should fail
      const result = canLoad("", null);
      assert.strictEqual(result.canLoad, false);
      if (!result.canLoad) {
        assert.strictEqual(result.reason, "invalid-url");
      }
    });
  });

  // Note: loadGraph itself is harder to unit test as it requires
  // mocking the loader and signin adapter. Those tests should be
  // integration tests or use proper mocking infrastructure.

  // This test doesn't need DOM because it returns early due to invalid URL
  test("loadGraph returns invalid-url for unparseable URL", async () => {
    const result = await loadGraph("", null, {
      loader: {} as never,
      signinAdapter: {} as never,
      boardServer: null as never,
    });

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.reason, "invalid-url");
    }
  });

  suite("loadGraph", () => {
    beforeEach(() => {
      setDOM();
    });

    afterEach(() => {
      unsetDOM();
    });

    test("returns load-failed when loader fails and user is signed in", async () => {
      const mockLoader = {
        load: async () => ({ success: false }),
      };

      const mockSigninAdapter = {
        get state() {
          return Promise.resolve("valid");
        },
      };

      const result = await loadGraph("https://example.com/board.json", null, {
        loader: mockLoader as never,
        signinAdapter: mockSigninAdapter as never,
        boardServer: null as never,
      });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.reason, "load-failed");
      }
    });

    test("returns auth-required when loader fails and user is signed out", async () => {
      const mockLoader = {
        load: async () => ({ success: false }),
      };

      const mockSigninAdapter = {
        get state() {
          return Promise.resolve("signedout");
        },
      };

      const result = await loadGraph("https://example.com/board.json", null, {
        loader: mockLoader as never,
        signinAdapter: mockSigninAdapter as never,
        boardServer: null as never,
      });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.reason, "auth-required");
      }
    });

    test("returns success with graph when loader succeeds", async () => {
      const mockGraph = { nodes: [], edges: [] };
      const mockLoader = {
        load: async () => ({ success: true, graph: mockGraph }),
      };

      const mockSigninAdapter = {
        get state() {
          return Promise.resolve("valid");
        },
      };

      const mockBoardServer = { name: "test" };

      const result = await loadGraph("https://example.com/board.json", null, {
        loader: mockLoader as never,
        signinAdapter: mockSigninAdapter as never,
        boardServer: mockBoardServer as never,
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.deepStrictEqual(result.graph, mockGraph);
        assert.strictEqual(result.boardServer, mockBoardServer);
      }
    });
  });
});
