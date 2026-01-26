/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types/data.js";
import { err, ok } from "@breadboard-ai/utils/outcome.js";
import {
  getSpreadsheetMetadata,
  getSpreadsheetValues,
  setSpreadsheetValues,
  updateSpreadsheet,
} from "./api.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import {
  MemoryManager,
  SheetMetadata,
  SheetMetadataWithFilePath,
} from "../agent/types.js";

export { SheetManager };

export type SheetGetter = (
  readonly: boolean
) => Promise<Outcome<string | null>>;

class SheetManager implements MemoryManager {
  private sheetId: Promise<Outcome<string | null>> | null = null;

  constructor(
    private readonly moduleArgs: A2ModuleArgs,
    private readonly sheetGetter: SheetGetter
  ) {}

  private checkSheetId() {
    return this.sheetGetter(true);
  }

  private ensureSheetId(): Promise<Outcome<string>> {
    if (!this.sheetId) {
      this.sheetId = this.sheetGetter(false);
    }
    return this.sheetId as Promise<Outcome<string>>;
  }

  async createSheet(args: SheetMetadata) {
    const { name } = args;

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const addSheet = await updateSpreadsheet(this.moduleArgs, sheetId, [
      { addSheet: { properties: { title: name } } },
    ]);
    if (!ok(addSheet)) {
      return { success: false, error: addSheet.$error };
    }

    const creating = await setSpreadsheetValues(
      this.moduleArgs,
      sheetId,
      `${name}!A1`,
      [args.columns]
    );
    if (!ok(creating)) {
      return { success: false, error: creating.$error };
    }
    return { success: true };
  }

  async readSheet(args: { range: string }) {
    const { range } = args;

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return getSpreadsheetValues(this.moduleArgs, sheetId, range);
  }

  async updateSheet(args: {
    range: string;
    values: string[][];
  }): Promise<Outcome<{ success: boolean; error?: string }>> {
    const { range, values } = args;

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const updating = await setSpreadsheetValues(
      this.moduleArgs,
      sheetId,
      range,
      values
    );
    if (!ok(updating)) {
      return { success: false, error: updating.$error };
    }

    return { success: true };
  }

  async deleteSheet(args: {
    name: string;
  }): Promise<Outcome<{ success: boolean; error?: string }>> {
    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const metadata = await getSpreadsheetMetadata(this.moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const sheet = metadata.sheets.find((s) => s.properties.title === args.name);
    if (!sheet) {
      return { success: false, error: `Sheet "${args.name}" not found.` };
    }

    const deleting = await updateSpreadsheet(this.moduleArgs, sheetId, [
      { deleteSheet: { sheetId: sheet.properties.sheetId } },
    ]);
    if (!ok(deleting)) return deleting;

    return { success: true };
  }

  async getSheetMetadata(): Promise<
    Outcome<{ sheets: SheetMetadataWithFilePath[] }>
  > {
    const sheetId = await this.checkSheetId();
    if (!sheetId) {
      return { sheets: [] };
    }
    if (!ok(sheetId)) return sheetId;
    this.sheetId = Promise.resolve(sheetId);

    const metadata = await getSpreadsheetMetadata(this.moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const errors: string[] = [];
    const sheetDetailsPromises = metadata.sheets.map(async (sheet) => {
      const { title: name, sheetId: id } = sheet.properties;
      if (id === 0) return null;
      const file_path = `/vfs/memory/${encodeURIComponent(name)}`;

      const valuesRes = await getSpreadsheetValues(
        this.moduleArgs,
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
      return { sheets };
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
