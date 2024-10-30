/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit, createLoader, Kit } from "@google-labs/breadboard";
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
  legacyGraphProviderExists,
} from "@breadboard-ai/board-server-management";

import { loadKits } from "../utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import BuildExampleKit from "../build-example-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";
import { addSandboxedRunModule } from "../sandbox/index.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

export async function create(config: RuntimeConfig): Promise<{
  board: Board;
  run: Run;
  edit: Edit;
  kits: Kit[];
}> {
  const kits = addSandboxedRunModule(
    await loadKits([
      asRuntimeKit(GeminiKit),
      asRuntimeKit(BuildExampleKit),
      asRuntimeKit(PythonWasmKit),
      asRuntimeKit(GoogleDriveKit),
    ])
  );

  const skipPlaygroundExamples = import.meta.env.MODE !== "development";
  let servers = await getBoardServers(
    kits,
    config.tokenVendor,
    skipPlaygroundExamples
  );

  // First run - set everything up.
  if (servers.length === 0) {
    await createDefaultLocalBoardServer(kits);

    // Migrate any legacy data. We do this in order so that IDB doesn't get
    // into a bad state with races and the like.
    if (await legacyGraphProviderExists()) {
      await migrateIDBGraphProviders(kits);
      await migrateRemoteGraphProviders();
      await migrateExampleGraphProviders();
      await migrateFileSystemProviders();
    }

    servers = await getBoardServers(kits);
  }

  const loader = createLoader(servers);
  const boardServers = {
    servers,
    loader,
  };

  const runtime = {
    board: new Board([], loader, kits, boardServers, config.tokenVendor),
    edit: new Edit([], loader, kits),
    run: new Run(config.dataStore, config.runStore, kits),
    kits,
  } as const;

  return runtime;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
