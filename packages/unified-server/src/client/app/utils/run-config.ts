/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  createLoader,
  GraphDescriptor,
  User,
} from "@google-labs/breadboard";
import { RunConfig } from "@google-labs/breadboard/harness";
import { RemoteBoardServer } from "@breadboard-ai/remote-board-server";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { BootstrapArguments } from "../types/types";

export async function createRunConfigWithProxy(
  graph: GraphDescriptor | null,
  serverConfig: BootstrapArguments,
  tokenVendor: TokenVendor
): Promise<RunConfig | null> {
  if (!graph || !graph.url) {
    return null;
  }

  const boardServers: BoardServer[] = [];
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
      boardServers.push(boardServer);
    }
  }

  const config: RunConfig = {
    url: graph.url,
    runner: graph,
    diagnostics: true,
    kits: [], // The kits are added by the runtime.
    loader: createLoader(boardServers),
    proxy: [],
    interactiveSecrets: "fallback",
  };

  if (serverConfig.proxyServerUrl) {
    config.proxy?.push({
      location: "http",
      url: serverConfig.proxyServerUrl.href,
      nodes: ["secrets", "fetch"],
    });

    console.log(
      "[Board Server] Using node proxy:",
      serverConfig.proxyServerUrl.href.replace(/\?API_KEY=.+$/, "")
    );
  }

  return config;
}
