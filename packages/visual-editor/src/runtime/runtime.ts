/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLoader, Kit } from "@google-labs/breadboard";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { RuntimeConfig, RuntimeConfigBoardServers } from "./types.js";

import {
  createDefaultLocalBoardServer,
  getBoardServers,
  migrateIDBGraphProviders,
  migrateRemoteGraphProviders,
  migrateExampleGraphProviders,
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
  const loader = createLoader(config.providers);
  const [kits] = await Promise.all([
    loadKits([GeminiKit, BuildExampleKit, PythonWasmKit, GoogleDriveKit]),
    ...config.providers.map((provider) => provider.restore()),
  ]);

  let boardServers: RuntimeConfigBoardServers | undefined = undefined;
  if (config.experiments.boardServers) {
    const skipPlaygroundExamples = import.meta.env.MODE !== "development";
    let servers = await getBoardServers(skipPlaygroundExamples);

    // First run - set everything up and migrate the data.
    if (servers.length === 0) {
      await createDefaultLocalBoardServer();
      await migrateIDBGraphProviders();
      await migrateRemoteGraphProviders();
      await migrateExampleGraphProviders();
      servers = await getBoardServers();
    }

    boardServers = {
      servers,
      loader: createLoader(servers),
    };
  }

  const runtime = {
    board: new Board(config.providers, loader, kits, boardServers),
    edit: new Edit(config.providers, loader, kits),
    run: new Run(config.dataStore, config.runStore, kits),
    kits,
  } as const;

  return runtime;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
