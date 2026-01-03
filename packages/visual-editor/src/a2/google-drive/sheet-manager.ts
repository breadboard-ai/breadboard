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

export { SheetManager };

export type SheetGetter = () => Promise<Outcome<string>>;

class SheetManager {
  private sheetId: Promise<Outcome<string>> | null = null;

  constructor(
    private readonly moduleArgs: A2ModuleArgs,
    private readonly sheetGetter: SheetGetter
  ) {}

  private ensureSheetId() {
    if (!this.sheetId) {
      this.sheetId = this.sheetGetter();
    }
    return this.sheetId;
  }

  async createSheet(args: { name: string; columns: string[] }) {
    const { name, columns } = args;
    console.log("NAME", name);
    console.log("COLUMNS", columns);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const addSheet = await updateSpreadsheet(this.moduleArgs, sheetId, [
      { addSheet: { properties: { title: name } } },
    ]);
    if (!ok(addSheet)) return addSheet;

    const creating = await setSpreadsheetValues(
      this.moduleArgs,
      sheetId,
      `${name}!A1`,
      [args.columns]
    );
    if (!ok(creating)) return creating;
    return { success: true };
  }

  async readSheet(args: { range: string }) {
    const { range } = args;
    console.log("RANGE", range);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return getSpreadsheetValues(this.moduleArgs, sheetId, range);
  }

  async updateSheet(args: { range: string; values: string[][] }) {
    const { range, values } = args;
    console.log("RANGE", range);
    console.log("VALUES", values);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const updating = await setSpreadsheetValues(
      this.moduleArgs,
      sheetId,
      range,
      values
    );
    if (!ok(updating)) {
      return { error: updating.$error };
    }

    return { success: true };
  }

  async deleteSheet(args: { name: string }) {
    const { name } = args;
    console.log("NAME", name);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const metadata = await getSpreadsheetMetadata(this.moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const sheet = metadata.sheets.find((s) => s.properties.title === args.name);
    if (!sheet) return err(`Sheet "${args.name}" not found.`);

    const deleting = await updateSpreadsheet(this.moduleArgs, sheetId, [
      { deleteSheet: { sheetId: sheet.properties.sheetId } },
    ]);
    if (!ok(deleting)) return deleting;

    return { sucess: true };
  }

  async querySheet(args: { name: string; query: string }) {
    const { name, query } = args;
    console.log(`NAME`, name);
    console.log(`QUERY`, query);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return {};
  }

  async getSheetMetadata(): Promise<
    Outcome<{ sheets: { name: string; columns: string[] }[] }>
  > {
    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    const metadata = await getSpreadsheetMetadata(this.moduleArgs, sheetId);
    if (!ok(metadata)) return metadata;

    const errors: string[] = [];
    const sheetDetailsPromises = metadata.sheets.map(async (sheet) => {
      const name = sheet.properties.title;

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

      return { name, columns };
    });

    try {
      const sheets = await Promise.all(sheetDetailsPromises);
      if (errors.length > 0) {
        return err(errors.join(","));
      }
      return { sheets };
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
