/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import { strictEqual } from "node:assert";
import {
  SheetManager,
  SheetGetter,
  SheetManagerConfig,
} from "../../src/a2/google-drive/sheet-manager.js";
import { NodeHandlerContext } from "@breadboard-ai/types";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

// Minimal stub context for testing
const stubContext: NodeHandlerContext = {} as NodeHandlerContext;

// Mock spreadsheet metadata response
const mockSpreadsheetMetadata = {
  sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
};

// Mock spreadsheet values response
const mockSpreadsheetValues = {
  values: [["A1", "B1"]],
};

// Stub config with mock fetchWithCreds
function createMockConfig() {
  const fetchMock = mock.fn(async (url: string) => {
    // Return appropriate mock based on URL pattern
    if (url.includes("/values/")) {
      return new Response(JSON.stringify(mockSpreadsheetValues));
    }
    // Default to metadata response
    return new Response(JSON.stringify(mockSpreadsheetMetadata));
  });
  return {
    config: {
      shell: {} as OpalShellHostProtocol,
      fetchWithCreds: fetchMock as unknown as typeof fetch,
    } as SheetManagerConfig,
    fetchMock,
  };
}

// Create a mock sheet getter that tracks calls
function createMockSheetGetter(sheetId: string): {
  sheetGetter: SheetGetter;
  callCount: () => number;
} {
  const calls: unknown[] = [];
  const sheetGetter: SheetGetter = async (_context, _readonly) => {
    calls.push({ _context, _readonly });
    return sheetId;
  };
  return { sheetGetter, callCount: () => calls.length };
}

describe("SheetManager", () => {
  describe("sheetGetter caching", () => {
    it("caches sheetId after first call to ensureSheetId", async () => {
      const { config } = createMockConfig();
      const { sheetGetter, callCount } = createMockSheetGetter("test-sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // First read should call sheetGetter
      await manager.readSheet(stubContext, { range: "Sheet1!A1" });
      strictEqual(callCount(), 1, "sheetGetter should be called once");

      // Second read should NOT call sheetGetter again (cached)
      await manager.readSheet(stubContext, { range: "Sheet1!A2" });
      strictEqual(callCount(), 1, "sheetGetter should still be 1 (cached)");
    });

    it("caches sheetId via checkSheetId for getSheetMetadata", async () => {
      const { config } = createMockConfig();
      const { sheetGetter, callCount } = createMockSheetGetter("test-sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // First metadata call should call sheetGetter
      await manager.getSheetMetadata(stubContext);
      strictEqual(callCount(), 1, "sheetGetter should be called once");

      // Second metadata call should NOT call sheetGetter again (cached)
      await manager.getSheetMetadata(stubContext);
      strictEqual(callCount(), 1, "sheetGetter should still be 1 (cached)");
    });
  });

  describe("metadata caching", () => {
    it("caches getSheetMetadata result", async () => {
      const { config, fetchMock } = createMockConfig();
      const { sheetGetter } = createMockSheetGetter("test-sheet-id");
      const manager = new SheetManager(config, sheetGetter);

      // First call should fetch
      await manager.getSheetMetadata(stubContext);
      const firstCallCount = fetchMock.mock.calls.length;

      // Second call should use cache
      await manager.getSheetMetadata(stubContext);
      strictEqual(
        fetchMock.mock.calls.length,
        firstCallCount,
        "fetch should not be called again (cached)"
      );
    });
  });
});
