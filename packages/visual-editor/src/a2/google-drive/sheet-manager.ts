/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types/data.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

export { SheetManager };

export type SheetGetter = (id: string) => Promise<Outcome<string>>;

class SheetManager {
  private sheetId: Promise<Outcome<string>> | null = null;

  constructor(
    private readonly id: string,
    private readonly sheetGetter: SheetGetter
  ) {}

  private ensureSheetId() {
    return (this.sheetId ??= this.sheetGetter(this.id));
  }

  async createSheet(args: { name: string; columns: string[] }) {
    const { name, columns } = args;
    console.log("NAME", name);
    console.log("COLUMNS", columns);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return {};
  }

  async readSheet(args: { range: string }) {
    const { range } = args;
    console.log("RANGE", range);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return {};
  }

  async updateSheet(args: { range: string; values: string[][] }) {
    const { range, values } = args;
    console.log("RANGE", range);
    console.log("VALUES", values);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return {};
  }

  async deleteSheet(args: { name: string }) {
    const { name } = args;
    console.log("NAME", name);

    const sheetId = await this.ensureSheetId();
    if (!ok(sheetId)) return sheetId;

    return {};
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

    return {
      sheets: [],
    };
  }
}
