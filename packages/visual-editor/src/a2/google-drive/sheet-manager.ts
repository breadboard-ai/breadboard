/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerContext, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils/outcome.js";
import {
  getSpreadsheetMetadata,
  getSpreadsheetValues,
  setSpreadsheetValues,
  SpreadsheetValueRange,
  updateSpreadsheet,
} from "./api.js";
import {
  MemoryManager,
  SheetMetadata,
  SheetMetadataWithFilePath,
} from "../agent/types.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export { SheetManager, parseSheetName };
export type { SheetManagerConfig };

type SheetManagerConfig = {
  shell: OpalShellHostProtocol;
  fetchWithCreds: typeof fetch;
};

export type SheetGetter = (
  context: NodeHandlerContext,
  readonly: boolean
) => Promise<Outcome<string | null>>;

/**
 * Extracts the sheet name from a range like "SheetName!A1:B10" or "'Sheet Name'!A1".
 * Returns null if no sheet name prefix (uses default sheet).
 */
function parseSheetName(range: string): string | null {
  const match = range.match(/^(?:'([^']+)'|([^!]+))!/);
  if (!match) return null;
  return match[1] || match[2];
}

type GraphCache = {
  sheetId: Promise<Outcome<string | null>> | null;
  readCache: Map<string, Outcome<SpreadsheetValueRange>>;
  metadata: Outcome<{ sheets: SheetMetadataWithFilePath[] }> | null;
};

class SheetManager implements MemoryManager {
  // All caches are scoped by graph URL to prevent cross-graph pollution
  private cacheByGraph = new Map<string, GraphCache>();

  constructor(
    private readonly config: SheetManagerConfig,
    private readonly sheetGetter: SheetGetter
  ) {}

  private getGraphKey(context: NodeHandlerContext): string {
    return context.currentGraph?.url || "";
  }

  private getGraphCache(context: NodeHandlerContext): GraphCache {
    const graphKey = this.getGraphKey(context);
    let cache = this.cacheByGraph.get(graphKey);
    if (!cache) {
      cache = { sheetId: null, readCache: new Map(), metadata: null };
      this.cacheByGraph.set(graphKey, cache);
    }
    return cache;
  }

  private checkSheetId(context: NodeHandlerContext) {
    const cache = this.getGraphCache(context);
    // sheetId is cached separately from reads - only invalidated on create
    if (cache.sheetId) return cache.sheetId;
    return this.sheetGetter(context, true);
  }

  private ensureSheetId(context: NodeHandlerContext): Promise<Outcome<string>> {
    const cache = this.getGraphCache(context);
    if (!cache.sheetId) {
      cache.sheetId = this.sheetGetter(context, false);
    }
    return cache.sheetId as Promise<Outcome<string>>;
  }

  private makeModuleArgs(context: NodeHandlerContext) {
    return { ...this.config, context };
  }

  private clearSheetCache(context: NodeHandlerContext, sheetName: string) {
    const cache = this.getGraphCache(context);
    // Clear matching read cache entries
    for (const range of cache.readCache.keys()) {
      const cachedSheetName = parseSheetName(range);
      if (cachedSheetName === sheetName) {
        cache.readCache.delete(range);
      }
    }
    // Always clear metadata since sheet list changed
    cache.metadata = null;
  }

  async createSheet(context: NodeHandlerContext, args: SheetMetadata) {
    const { name } = args;

    const sheetId = await this.ensureSheetId(context);
    if (!ok(sheetId)) return sheetId;

    const moduleArgs = this.makeModuleArgs(context);
    const addSheet = await updateSpreadsheet(moduleArgs, sheetId, [
      { addSheet: { properties: { title: name } } },
    ]);
    if (!ok(addSheet)) {
      return { success: false, error: addSheet.$error };
    }

    const creating = await setSpreadsheetValues(
      moduleArgs,
      sheetId,
      `${name}!A1`,
      [args.columns]
    );
    if (!ok(creating)) {
      return { success: false, error: creating.$error };
    }

    this.clearSheetCache(context, name);
    return { success: true };
  }

  async readSheet(context: NodeHandlerContext, args: { range: string }) {
    const { range } = args;

    const cache = this.getGraphCache(context);

    // Check cache first
    const cached = cache.readCache.get(range);
    if (cached) return cached;

    const sheetId = await this.ensureSheetId(context);
    if (!ok(sheetId)) return sheetId;

    const result = await getSpreadsheetValues(
      this.makeModuleArgs(context),
      sheetId,
      range
    );

    // Cache the result
    cache.readCache.set(range, result);
    return result;
  }

  async updateSheet(
    context: NodeHandlerContext,
    args: { range: string; values: string[][] }
  ): Promise<Outcome<{ success: boolean; error?: string }>> {
    const { range, values } = args;

    const sheetId = await this.ensureSheetId(context);
    if (!ok(sheetId)) return sheetId;

    const updating = await setSpreadsheetValues(
      this.makeModuleArgs(context),
      sheetId,
      range,
      values
    );
    if (!ok(updating)) {
      return { success: false, error: updating.$error };
    }

    const sheetName = parseSheetName(range);
    if (sheetName) this.clearSheetCache(context, sheetName);
    return { success: true };
  }

  async deleteSheet(
    context: NodeHandlerContext,
    args: { name: string }
  ): Promise<Outcome<{ success: boolean; error?: string }>> {
    const sheetId = await this.ensureSheetId(context);
    if (!ok(sheetId)) return sheetId;

    const moduleArgs = this.makeModuleArgs(context);
    const metadata = await getSpreadsheetMetadata(moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const sheet = metadata.sheets.find((s) => s.properties.title === args.name);
    if (!sheet) {
      return { success: false, error: `Sheet "${args.name}" not found.` };
    }

    const deleting = await updateSpreadsheet(moduleArgs, sheetId, [
      { deleteSheet: { sheetId: sheet.properties.sheetId } },
    ]);
    if (!ok(deleting)) return deleting;

    this.clearSheetCache(context, args.name);
    return { success: true };
  }

  async getSheetMetadata(
    context: NodeHandlerContext
  ): Promise<Outcome<{ sheets: SheetMetadataWithFilePath[] }>> {
    const cache = this.getGraphCache(context);

    // Check cache first
    if (cache.metadata) return cache.metadata;

    const sheetId = await this.checkSheetId(context);
    if (!sheetId) {
      return { sheets: [] };
    }
    if (!ok(sheetId)) return sheetId;
    cache.sheetId = Promise.resolve(sheetId);

    const moduleArgs = this.makeModuleArgs(context);
    const metadata = await getSpreadsheetMetadata(moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const errors: string[] = [];
    const sheetDetailsPromises = metadata.sheets.map(async (sheet) => {
      const { title: name, sheetId: id } = sheet.properties;
      if (id === 0) return null;
      const file_path = `/vfs/memory/${encodeURIComponent(name)}`;

      const valuesRes = await getSpreadsheetValues(
        moduleArgs,
        sheetId,
        `${encodeURIComponent(name)}!1:1`
      );
      let columns: string[] = [];
      if (!ok(valuesRes)) {
        errors.push(valuesRes.$error);
      } else {
        if (valuesRes.values && valuesRes.values.length > 0) {
          columns = valuesRes.values[0] as string[];
        }
      }

      return { name, file_path, columns };
    });

    try {
      const sheets = (await Promise.all(sheetDetailsPromises)).filter(
        (sheet) => sheet !== null
      );
      if (errors.length > 0) {
        return err(errors.join(","));
      }
      const result = { sheets };
      cache.metadata = result;
      return result;
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
