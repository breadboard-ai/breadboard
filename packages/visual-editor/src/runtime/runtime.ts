/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLoader, Kit } from "@google-labs/breadboard";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { VERuntimeConfig } from "./types.js";

import { loadKits } from "../utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import BuildExampleKit from "../build-example-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";

export * as Events from "./events.js";
export * as Types from "./types.js";

export async function create(config: VERuntimeConfig): Promise<{
  board: Board;
  run: Run;
  edit: Edit;
  kits: Kit[];
}> {
  const loader = createLoader(config.providers);
  const [kits] = await Promise.all([
    loadKits([GeminiKit, BuildExampleKit, PythonWasmKit, GoogleDriveKit]),
    ...config.providers.map((provider) => provider.restore()),
  ]);

  return {
    board: new Board(config.providers, loader, kits),
    edit: new Edit(config.providers, loader, kits),
    run: new Run(config.dataStore, config.runStore, kits),
    kits,
  } as const;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
