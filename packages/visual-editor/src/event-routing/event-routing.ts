/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "@google-labs/breadboard";
import { addNodeProxyServerConfig } from "../data/node-proxy-servers";
import { EventRoute } from "./types";

export const ModeRoute: EventRoute<"modetoggle"> = {
  event: "modetoggle",

  async do({ runtime, originalEvent }) {
    runtime.router.go(window.location.href, originalEvent.detail.mode);
    return false;
  },
};

export const BoardRunRoute: EventRoute<"boardrun"> = {
  event: "boardrun",

  async do({ tab, proxy, runtime, settings }) {
    const url = tab?.graph?.url;
    if (!url || !tab || !settings) {
      return false;
    }
    runtime.edit.sideboards.discardTasks();

    const graph = tab?.graph;
    const proxyableUrl = new URL(url, window.location.href);
    let proxyUrl: string | null = null;
    for (const boardServer of runtime.board.boardServers.servers) {
      const boardServerProxyUrl = await boardServer.canProxy?.(proxyableUrl);
      if (!boardServerProxyUrl) {
        continue;
      }

      proxyUrl = boardServerProxyUrl;
      break;
    }

    const runConfig = addNodeProxyServerConfig(
      proxy,
      {
        url,
        runner: graph,
        diagnostics: true,
        kits: [], // The kits are added by the runtime.
        loader: runtime.board.getLoader(),
        graphStore: runtime.edit.graphStore,
        fileSystem: runtime.edit.graphStore.fileSystem.createRunFileSystem({
          graphUrl: url,
          env: envFromGraphDescriptor(
            runtime.edit.graphStore.fileSystem.env(),
            graph
          ),
          assets: assetsFromGraphDescriptor(graph),
        }),
        inputs: BreadboardUI.Data.inputsFromSettings(settings),
        interactiveSecrets: true,
      },
      settings,
      undefined /* no longer used */,
      proxyUrl
    );

    runtime.run.runBoard(tab, runConfig);
    return false;
  },
};

export const BoardLoadRoute: EventRoute<"boardload"> = {
  event: "boardload",

  async do({ runtime, originalEvent, uiState }) {
    runtime.router.go(originalEvent.detail.url, uiState.mode);
    return false;
  },
};

export const SelectionStateChangeRoute: EventRoute<"selectionstatechange"> = {
  event: "selectionstatechange",

  async do({ runtime, originalEvent, tab }) {
    if (!tab) {
      return false;
    }

    runtime.select.processSelections(
      tab.id,
      originalEvent.detail.selectionChangeId,
      originalEvent.detail.selections,
      originalEvent.detail.replaceExistingSelections,
      originalEvent.detail.moveToSelection
    );
    return false;
  },
};
