/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { ok } from "@breadboard-ai/utils/outcome.js";
import {
  SheetManager,
  SheetGetter,
  SheetManagerConfig,
  isSystemSheet,
  SYSTEM_SHEET_PREFIX,
} from "../../src/a2/google-drive/sheet-manager.js";
import { NodeHandlerContext } from "@breadboard-ai/types";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

// Minimal stub context for testing
const stubContext: NodeHandlerContext = {} as NodeHandlerContext;

// Helper to create a context with a specific graph URL
function createContextWithGraph(url: string): NodeHandlerContext {
  return {
    currentGraph: { url },
  } as NodeHandlerContext;
}

// Mock responses
const mockSpreadsheetMetadata = {
  sheets: [
    { properties: { title: "Sheet1", sheetId: 1 } },
    { properties: { title: "intro", sheetId: 0 } }, // Should be filtered out (id=0)
  ],
};

const mockSpreadsheetValues = {
  values: [["ColA", "ColB"]],
};

// Helper to create mock config with customizable fetch behavior
function createMockConfig(
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
) {
  const defaultImpl = async (url: string) => {
    if (url.includes("/values/")) {
      return new Response(JSON.stringify(mockSpreadsheetValues));
    }
    return new Response(JSON.stringify(mockSpreadsheetMetadata));
  };
  const fetchMock = mock.fn(fetchImpl || defaultImpl);
  return {
    config: {
      shell: {} as OpalShellHostProtocol,
      fetchWithCreds: fetchMock as unknown as typeof fetch,
    } as SheetManagerConfig,
    fetchMock,
  };
}

// Helper to create mock sheet getter
function createMockSheetGetter(sheetId: string | null | { $error: string }): {
  sheetGetter: SheetGetter;
  callCount: () => number;
} {
  const calls: unknown[] = [];
  const sheetGetter: SheetGetter = async (_context, _readonly) => {
    calls.push({ _context, _readonly });
    if (sheetId && typeof sheetId === "object" && "$error" in sheetId) {
      return sheetId;
    }
    return sheetId;
  };
  return { sheetGetter, callCount: () => calls.length };
}

describe("SheetManager", () => {
  // ==================== sheetGetter caching ====================
  describe("sheetGetter caching", () => {
    it("caches sheetId after first call via ensureSheetId", async () => {
      const { config } = createMockConfig();
      const { sheetGetter, callCount } = createMockSheetGetter("test-id");
      const manager = new SheetManager(config, sheetGetter);

      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      strictEqual(callCount(), 1);

      await manager.readSheet(stubContext, { range: "Sheet1!A2" });
      strictEqual(callCount(), 1, "should not call sheetGetter again");
    });

    it("caches sheetId after first call via checkSheetId", async () => {
      const { config } = createMockConfig();
      const { sheetGetter, callCount } = createMockSheetGetter("test-id");
      const manager = new SheetManager(config, sheetGetter);

      await manager.getSheetMetadata(stubContext);
      strictEqual(callCount(), 1);

      await manager.getSheetMetadata(stubContext);
      strictEqual(callCount(), 1, "should not call sheetGetter again");
    });
  });

  // ==================== graph-scoped cache isolation ====================
  describe("graph-scoped cache isolation", () => {
    it("isolates sheetId cache between different graphs", async () => {
      const { config } = createMockConfig();
      const { sheetGetter, callCount } = createMockSheetGetter("test-id");
      const manager = new SheetManager(config, sheetGetter);

      const graphAContext = createContextWithGraph(
        "https://example.com/graphA"
      );
      const graphBContext = createContextWithGraph(
        "https://example.com/graphB"
      );

      // First call to graph A
      await manager.readSheet(graphAContext, { range: "Sheet1!A1" });
      strictEqual(callCount(), 1);

      // First call to graph B should call sheetGetter again
      await manager.readSheet(graphBContext, { range: "Sheet1!A1" });
      strictEqual(callCount(), 2, "should call sheetGetter for each graph");

      // Second call to graph A should use cached sheetId
      await manager.readSheet(graphAContext, { range: "Sheet1!A2" });
      strictEqual(
        callCount(),
        2,
        "should not call sheetGetter again for graph A"
      );
    });

    it("isolates read cache between different graphs", async () => {
      const { config, fetchMock } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("test-id");
      const manager = new SheetManager(config, sheetGetter);

      const graphAContext = createContextWithGraph(
        "https://example.com/graphA"
      );
      const graphBContext = createContextWithGraph(
        "https://example.com/graphB"
      );

      // Read same range from graph A
      await manager.readSheet(graphAContext, { range: "Sheet1!A1" });
      const countAfterFirstRead = fetchMock.mock.calls.length;

      // Read same range from graph B - should NOT use graph A's cache
      await manager.readSheet(graphBContext, { range: "Sheet1!A1" });
      strictEqual(
        fetchMock.mock.calls.length > countAfterFirstRead,
        true,
        "should make new API call for different graph"
      );
    });

    it("isolates metadata cache between different graphs", async () => {
      const { config, fetchMock } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("test-id");
      const manager = new SheetManager(config, sheetGetter);

      const graphAContext = createContextWithGraph(
        "https://example.com/graphA"
      );
      const graphBContext = createContextWithGraph(
        "https://example.com/graphB"
      );

      // Get metadata for graph A
      await manager.getSheetMetadata(graphAContext);
      const countAfterFirst = fetchMock.mock.calls.length;

      // Get metadata for graph B - should NOT use graph A's cache
      await manager.getSheetMetadata(graphBContext);
      strictEqual(
        fetchMock.mock.calls.length > countAfterFirst,
        true,
        "should make new API call for different graph"
      );
    });

    it("cache invalidation only affects the specified graph", async () => {
      const { config, fetchMock } = createMockConfig(
        async () => new Response("{}")
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const graphAContext = createContextWithGraph(
        "https://example.com/graphA"
      );
      const graphBContext = createContextWithGraph(
        "https://example.com/graphB"
      );

      // Prime caches for both graphs
      await manager.readSheet(graphAContext, { range: "Sheet1!A1" });
      await manager.readSheet(graphBContext, { range: "Sheet1!A1" });
      const countAfterReads = fetchMock.mock.calls.length;

      // Update in graph A should only clear graph A's cache
      await manager.updateSheet(graphAContext, {
        range: "Sheet1!A1",
        values: [["new"]],
      });

      // Read from graph A should make new API call (cache cleared)
      await manager.readSheet(graphAContext, { range: "Sheet1!A1" });
      // Read from graph B should still be cached
      await manager.readSheet(graphBContext, { range: "Sheet1!A1" });

      // Only one new read call expected (for graph A)
      // updateSheet makes 1 call, then readSheet for A makes 1 call
      // readSheet for B should be cached (0 calls)
      strictEqual(
        fetchMock.mock.calls.length,
        countAfterReads + 2,
        "graph B should still be cached"
      );
    });
  });

  // ==================== createSheet ====================
  describe("createSheet", () => {
    it("successfully creates a sheet", async () => {
      const { config } = createMockConfig(async () => new Response("{}"));
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.createSheet(stubContext, {
        name: "NewSheet",
        columns: ["A", "B"],
      });

      deepStrictEqual(result, { success: true });
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Failed to get sheet",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.createSheet(stubContext, {
        name: "NewSheet",
        columns: ["A"],
      });

      strictEqual(ok(result), false);
    });

    it("returns error when addSheet fails", async () => {
      let callCount = 0;
      const { config } = createMockConfig(async () => {
        callCount++;
        if (callCount === 1) {
          // First call is updateSpreadsheet (addSheet)
          return new Response(JSON.stringify({ error: "Add failed" }), {
            status: 400,
          });
        }
        return new Response("{}");
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.createSheet(stubContext, {
        name: "NewSheet",
        columns: ["A"],
      });

      strictEqual((result as { success: boolean }).success, false);
    });

    it("clears cache after successful create", async () => {
      const { config, fetchMock } = createMockConfig(
        async () => new Response("{}")
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // Prime the cache
      await manager.readSheet(stubContext, { range: "NewSheet!A1" });
      const countAfterRead = fetchMock.mock.calls.length;

      // Create sheet should clear cache
      await manager.createSheet(stubContext, {
        name: "NewSheet",
        columns: ["A"],
      });

      // Read again should hit API, not cache
      await manager.readSheet(stubContext, { range: "NewSheet!A1" });
      strictEqual(
        fetchMock.mock.calls.length > countAfterRead + 2,
        true,
        "should make a new fetch call"
      );
    });
  });

  // ==================== readSheet ====================
  describe("readSheet", () => {
    it("returns cached result on second call", async () => {
      const { config, fetchMock } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      await manager.readSheet(stubContext, { range: "Sheet1!A1:B10" });
      const countAfterFirst = fetchMock.mock.calls.length;

      const result = await manager.readSheet(stubContext, {
        range: "Sheet1!A1:B10",
      });
      strictEqual(
        fetchMock.mock.calls.length,
        countAfterFirst,
        "should use cache"
      );
      strictEqual(ok(result), true);
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Sheet not found",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.readSheet(stubContext, {
        range: "Sheet1!A1",
      });

      strictEqual(ok(result), false);
    });
  });

  // ==================== updateSheet ====================
  describe("updateSheet", () => {
    it("successfully updates a sheet", async () => {
      const { config } = createMockConfig(async () => new Response("{}"));
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.updateSheet(stubContext, {
        range: "Sheet1!A1",
        values: [["value"]],
      });

      deepStrictEqual(result, { success: true });
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Sheet not found",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.updateSheet(stubContext, {
        range: "Sheet1!A1",
        values: [["value"]],
      });

      strictEqual(ok(result), false);
    });

    it("returns error when setSpreadsheetValues fails", async () => {
      const { config } = createMockConfig(
        async () =>
          new Response(JSON.stringify({ error: { message: "Update failed" } }))
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.updateSheet(stubContext, {
        range: "Sheet1!A1",
        values: [["value"]],
      });

      strictEqual((result as { success: boolean }).success, false);
    });

    it("clears only affected sheet cache", async () => {
      const { config, fetchMock } = createMockConfig(
        async () => new Response("{}")
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // Prime caches for two different sheets
      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      await manager.readSheet(stubContext, { range: "Sheet2!A1" });
      const countAfterReads = fetchMock.mock.calls.length;

      // Update Sheet1 only
      await manager.updateSheet(stubContext, {
        range: "Sheet1!A1",
        values: [["new"]],
      });

      // Read Sheet1 should make new API call (cache cleared)
      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      // Read Sheet2 should still be cached
      await manager.readSheet(stubContext, { range: "Sheet2!A1" });

      // Only one new read call expected (for Sheet1)
      strictEqual(
        fetchMock.mock.calls.length,
        countAfterReads + 2,
        "Sheet2 should still be cached"
      );
    });

    it("handles range without sheet name", async () => {
      const { config } = createMockConfig(async () => new Response("{}"));
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // Range without sheet prefix
      const result = await manager.updateSheet(stubContext, {
        range: "A1:B10",
        values: [["value"]],
      });

      deepStrictEqual(result, { success: true });
    });
  });

  // ==================== deleteSheet ====================
  describe("deleteSheet", () => {
    it("successfully deletes a sheet", async () => {
      const { config } = createMockConfig(async (url) => {
        if (url.includes(":batchUpdate")) {
          return new Response("{}");
        }
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.deleteSheet(stubContext, { name: "Sheet1" });

      deepStrictEqual(result, { success: true });
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Sheet not found",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.deleteSheet(stubContext, {
        name: "Sheet1",
      });

      strictEqual(ok(result), false);
    });

    it("returns error when sheet not found", async () => {
      const { config } = createMockConfig(async () => {
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.deleteSheet(stubContext, {
        name: "NonExistentSheet",
      });

      deepStrictEqual(result, {
        success: false,
        error: 'Sheet "NonExistentSheet" not found.',
      });
    });

    it("clears cache after successful delete", async () => {
      const { config, fetchMock } = createMockConfig(async (url) => {
        if (url.includes(":batchUpdate")) {
          return new Response("{}");
        }
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // Prime cache
      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      const countAfterRead = fetchMock.mock.calls.length;

      // Delete sheet
      await manager.deleteSheet(stubContext, { name: "Sheet1" });

      // Read again should hit API
      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      strictEqual(
        fetchMock.mock.calls.length > countAfterRead + 2,
        true,
        "should make new fetch call"
      );
    });
  });

  // ==================== getSheetMetadata ====================
  describe("getSheetMetadata", () => {
    it("returns cached result on second call", async () => {
      const { config, fetchMock } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      await manager.getSheetMetadata(stubContext);
      const countAfterFirst = fetchMock.mock.calls.length;

      await manager.getSheetMetadata(stubContext);
      strictEqual(
        fetchMock.mock.calls.length,
        countAfterFirst,
        "should use cache"
      );
    });

    it("returns empty sheets when sheetId is null", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter(null);
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      deepStrictEqual(result, { sheets: [] });
    });

    it("returns error when sheetGetter returns error", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Get sheet failed",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      strictEqual(ok(result), false);
    });

    it("filters out sheets with id=0", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      if (!ok(result)) {
        throw new Error("Expected success");
      }
      // intro sheet (id=0) should be filtered out
      strictEqual(result.sheets.length, 1);
      strictEqual(result.sheets[0].name, "Sheet1");
    });

    it("handles empty values response", async () => {
      const { config } = createMockConfig(async (url) => {
        if (url.includes("/values/")) {
          return new Response(JSON.stringify({})); // No values property
        }
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      if (!ok(result)) {
        throw new Error("Expected success");
      }
      deepStrictEqual(result.sheets[0].columns, []);
    });

    it("returns error when getSpreadsheetValues fails", async () => {
      const { config } = createMockConfig(async (url) => {
        if (url.includes("/values/")) {
          return new Response(
            JSON.stringify({ error: { message: "Values failed" } })
          );
        }
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      strictEqual(ok(result), false);
      strictEqual(
        (result as { $error: string }).$error.includes("Values failed"),
        true
      );
    });

    it("catches exceptions in sheet processing", async () => {
      const { config } = createMockConfig(async (url) => {
        if (url.includes("/values/")) {
          throw new Error("Network error");
        }
        return new Response(JSON.stringify(mockSpreadsheetMetadata));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);

      strictEqual(ok(result), false);
    });
  });

  // ==================== createSheet setValues failure ====================
  describe("createSheet setValues failure", () => {
    it("returns error when setSpreadsheetValues fails after addSheet succeeds", async () => {
      let callCount = 0;
      const { config } = createMockConfig(async () => {
        callCount++;
        if (callCount === 1) {
          // First call is updateSpreadsheet (addSheet) - success
          return new Response("{}");
        }
        // Second call is setSpreadsheetValues - failure
        return new Response(
          JSON.stringify({ error: { message: "Set values failed" } })
        );
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.createSheet(stubContext, {
        name: "NewSheet",
        columns: ["A", "B"],
      });

      deepStrictEqual(result, {
        success: false,
        error: "Set values failed",
      });
    });
  });
});

// ==================== isSystemSheet ====================
describe("isSystemSheet", () => {
  it("returns true for sheets with __ prefix", () => {
    strictEqual(isSystemSheet("__chat_log__"), true);
    strictEqual(isSystemSheet("__internal"), true);
  });

  it("returns false for normal sheets", () => {
    strictEqual(isSystemSheet("Sheet1"), false);
    strictEqual(isSystemSheet("_single_underscore"), false);
    strictEqual(isSystemSheet("notes"), false);
  });

  it("SYSTEM_SHEET_PREFIX is __", () => {
    strictEqual(SYSTEM_SHEET_PREFIX, "__");
  });
});

describe("SheetManager system sheet features", () => {
  // ==================== getSheetMetadata system sheet filtering ====================
  describe("getSheetMetadata filters system sheets", () => {
    it("filters out system sheets from metadata results", async () => {
      const metadataWithSystemSheet = {
        sheets: [
          { properties: { title: "Sheet1", sheetId: 1 } },
          { properties: { title: "__chat_log__", sheetId: 2 } },
          { properties: { title: "intro", sheetId: 0 } },
        ],
      };
      const { config } = createMockConfig(async (url) => {
        if (url.includes("/values/")) {
          return new Response(JSON.stringify(mockSpreadsheetValues));
        }
        return new Response(JSON.stringify(metadataWithSystemSheet));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.getSheetMetadata(stubContext);
      if (!ok(result)) throw new Error("Expected success");

      // Only Sheet1 should remain (id=0 and __chat_log__ filtered out)
      strictEqual(result.sheets.length, 1);
      strictEqual(result.sheets[0].name, "Sheet1");
    });
  });

  // ==================== appendToSheet ====================
  describe("appendToSheet", () => {
    it("successfully appends values to a sheet", async () => {
      const { config } = createMockConfig(async () => new Response("{}"));
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.appendToSheet(stubContext, {
        range: "__chat_log__!A:D",
        values: [["ts", "session", "user", "hello"]],
      });

      deepStrictEqual(result, { success: true });
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "Sheet not found",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.appendToSheet(stubContext, {
        range: "__chat_log__!A:D",
        values: [["ts", "session", "user", "hello"]],
      });

      strictEqual(ok(result), false);
    });

    it("returns error when API call fails", async () => {
      const { config } = createMockConfig(
        async () =>
          new Response(JSON.stringify({ error: { message: "Append failed" } }))
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.appendToSheet(stubContext, {
        range: "__chat_log__!A:D",
        values: [["ts", "session", "user", "hello"]],
      });

      strictEqual(ok(result), false);
    });

    it("clears cache for the affected sheet", async () => {
      const { config, fetchMock } = createMockConfig(
        async () => new Response("{}")
      );
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // Prime cache
      await manager.readSheet(stubContext, { range: "__chat_log__!A:D" });
      // Read again — should hit cache (no new fetch)
      await manager.readSheet(stubContext, { range: "__chat_log__!A:D" });
      const countBeforeAppend = fetchMock.mock.calls.length;

      // Append should clear cache
      await manager.appendToSheet(stubContext, {
        range: "__chat_log__!A:D",
        values: [["ts", "session", "user", "hello"]],
      });

      // Read again should hit API (cache cleared)
      await manager.readSheet(stubContext, { range: "__chat_log__!A:D" });
      // append = 1 call, read = 1 call = 2 new calls
      strictEqual(
        fetchMock.mock.calls.length,
        countBeforeAppend + 2,
        "should make new fetch calls for append + read after cache clear"
      );
    });
  });

  // ==================== ensureSystemSheet ====================
  describe("ensureSystemSheet", () => {
    it("creates sheet when it does not exist", async () => {
      const metadataWithoutSystemSheet = {
        sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
      };
      const { config } = createMockConfig(async (url) => {
        // Metadata call or addSheet/setValues calls
        if (
          url.includes(":batchUpdate") ||
          url.includes("/values/") ||
          url.endsWith("sheet-id")
        ) {
          // If contains :batchUpdate, it's creating the sheet
          // If contains /values/, it's setting initial column headers
          return new Response("{}");
        }
        return new Response(JSON.stringify(metadataWithoutSystemSheet));
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.ensureSystemSheet(
        stubContext,
        "__chat_log__",
        ["timestamp", "session_id", "role", "content"]
      );

      deepStrictEqual(result, { success: true });
    });

    it("skips creation when sheet already exists", async () => {
      const { config, fetchMock } = createMockConfig(async () => {
        return new Response(
          JSON.stringify({
            sheets: [{ properties: { title: "__chat_log__", sheetId: 5 } }],
          })
        );
      });
      const { sheetGetter } = createMockSheetGetter("sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.ensureSystemSheet(
        stubContext,
        "__chat_log__",
        ["timestamp", "session_id", "role", "content"]
      );

      deepStrictEqual(result, { success: true });
      // Should only have the metadata fetch, no addSheet/setValues calls
      // (sheetGetter + metadata = 2 calls)
      strictEqual(fetchMock.mock.calls.length, 1);
    });

    it("returns error when sheetGetter fails", async () => {
      const { config } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter({
        $error: "No sheet",
      });
      const manager = new SheetManager(config, sheetGetter);

      const result = await manager.ensureSystemSheet(
        stubContext,
        "__chat_log__",
        ["timestamp"]
      );

      strictEqual(ok(result), false);
    });
  });
});
