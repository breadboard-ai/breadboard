/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addSandboxedRunModule,
  assetsFromGraphDescriptor,
  BoardServer,
  createEphemeralBlobStore,
  createFileSystem,
  createGraphStore,
  createLoader,
  envFromGraphDescriptor,
  GraphDescriptor,
  User,
} from "@google-labs/breadboard";
import { HarnessProxyConfig, RunConfig } from "@google-labs/breadboard/harness";
import { RemoteBoardServer } from "@breadboard-ai/remote-board-server";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { BootstrapArguments } from "../types/types";
import { createA2Server } from "@breadboard-ai/a2";
import { loadKits, registerLegacyKits } from "./kit-loader";
import { sandbox } from "../sandbox";
import {
  createFileSystemBackend,
  getDataStore,
} from "@breadboard-ai/data-store";
import { BoardServerAwareDataStore } from "@breadboard-ai/board-server-management";

export async function createRunConfig(
  graph: GraphDescriptor | null,
  serverConfig: BootstrapArguments,
  tokenVendor: TokenVendor,
  abortController: AbortController
): Promise<RunConfig | null> {
  if (!graph || !graph.url) {
    return null;
  }

  // 1) Load board servers. The App view only has two:
  // - the unified server
  // - the A2 embedded server (which has the A2 framework and steps)
  const servers: BoardServer[] = [];
  if (serverConfig.boardServerUrl) {
    const user: User = { username: "", apiKey: "", secrets: new Map() };
    const boardServer = await RemoteBoardServer.from(
      serverConfig.boardServerUrl.href,
      "Server",
      user,
      tokenVendor,
      /** autoLoadProjects */ false
    );
    if (boardServer) {
      servers.push(boardServer);
    }
  }
  servers.push(createA2Server());

  // 2) Create board-server aware datastore: it allows persisting blobs
  // to the board server.
  const dataStore = new BoardServerAwareDataStore(
    getDataStore(),
    servers,
    new URL(graph.url)
  );

  // 3) Add the JS Sandbox
  const kits = addSandboxedRunModule(sandbox, loadKits());

  // 4) Create the file system
  const fileSystem = createFileSystem({
    env: [],
    local: createFileSystemBackend(createEphemeralBlobStore()),
  });

  // 5) Create the loader that allows loading BGLs from servers
  const loader = createLoader(servers);

  // 6) Create the graph store, which stores and manages all the BGLs that
  // were loaded
  const graphStore = createGraphStore({
    kits,
    loader,
    sandbox,
    fileSystem,
  });
  // 7) Get all the old kits (core, json, templates, etc.) into the graph
  // store. They will be presented as fake/stub BGLs.
  registerLegacyKits(graphStore);

  // 8) Add and configure node proxy, which allows proxying fetch and tunneling
  //  secrets on the server.
  const proxy: HarnessProxyConfig[] = [];
  if (serverConfig.proxyServerUrl) {
    proxy.push({
      location: "http",
      url: serverConfig.proxyServerUrl.href,
      nodes: ["secrets", "fetch"],
    });

    console.log(
      "[Board Server] Using node proxy:",
      serverConfig.proxyServerUrl.href.replace(/\?API_KEY=.+$/, "")
    );
  }

  // 9) Create the config.
  return {
    url: graph.url,
    runner: graph,
    diagnostics: true,
    loader: createLoader(servers),
    proxy,
    interactiveSecrets: "fallback",
    store: dataStore,
    kits: [...graphStore.kits],
    signal: abortController.signal,
    graphStore: graphStore,
    fileSystem: fileSystem.createRunFileSystem({
      graphUrl: graph.url!,
      env: envFromGraphDescriptor([], graph),
      assets: assetsFromGraphDescriptor(graph),
    }),
  };
}
