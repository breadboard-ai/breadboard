/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLoader, Kit } from "@google-labs/breadboard";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { RuntimeConfig } from "./types.js";

import {
  createDefaultLocalBoardServer,
  getBoardServers,
  migrateIDBGraphProviders,
  migrateRemoteGraphProviders,
  migrateExampleGraphProviders,
  migrateFileSystemProviders,
} from "@breadboard-ai/board-server-management";

import { loadKits } from "../utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import BuildExampleKit from "../build-example-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";

export * as Events from "./events.js";
export * as Types from "./types.js";

export async function create(config: RuntimeConfig): Promise<{
  board: Board;
  run: Run;
  edit: Edit;
  kits: Kit[];
}> {
  const kits = await loadKits([
    GeminiKit,
    BuildExampleKit,
    PythonWasmKit,
    GoogleDriveKit,
  ]);

  const skipPlaygroundExamples = import.meta.env.MODE !== "development";
  const auth = {
    connectionId: "google-drive-limited",
    tokenVendor: config.tokenVendor!,
  };
  let servers = await getBoardServers(auth, skipPlaygroundExamples);

  // First run - set everything up and migrate the data.
  if (servers.length === 0) {
    await createDefaultLocalBoardServer();
    await migrateIDBGraphProviders();
    await migrateRemoteGraphProviders();
    await migrateExampleGraphProviders();
    await migrateFileSystemProviders();
    servers = await getBoardServers();
  }

  const loader = createLoader(servers);
  const boardServers = {
    servers,
    loader,
  };

  const runtime = {
    board: new Board(
      [],
      loader,
      kits,
      boardServers,
      config.environment,
      config.tokenVendor
    ),
    edit: new Edit([], loader, kits),
    run: new Run(config.dataStore, config.runStore, kits),
    kits,
  } as const;

  return runtime;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
