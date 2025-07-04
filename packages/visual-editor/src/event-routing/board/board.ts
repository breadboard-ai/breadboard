/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
  InputValues,
} from "@google-labs/breadboard";
import { addNodeProxyServerConfig } from "../../data/node-proxy-servers";

export const RunRoute: EventRoute<"board.run"> = {
  event: "board.run",

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

export const LoadRoute: EventRoute<"board.load"> = {
  event: "board.load",

  async do({ runtime, originalEvent, uiState }) {
    runtime.router.go(originalEvent.detail.url, uiState.mode);
    return false;
  },
};

export const StopRoute: EventRoute<"board.stop"> = {
  event: "board.stop",

  async do({ tab, runtime, originalEvent }) {
    if (!tab) {
      return false;
    }

    const tabId = tab?.id ?? null;
    const abortController = runtime.run.getAbortSignal(tabId);
    if (!abortController) {
      return false;
    }

    abortController.abort("Run stopped");
    const runner = runtime.run.getRunner(tabId);
    if (runner?.running()) {
      await runner?.run();
    }

    if (originalEvent.detail.clearLastRun) {
      await runtime.run.clearLastRun(tabId, tab?.graph.url);
    }

    return true;
  },
};

export const InputRoute: EventRoute<"board.input"> = {
  event: "board.input",

  async do({ tab, runtime, settings, secretsHelper, originalEvent }) {
    if (!settings || !tab) {
      return false;
    }

    const isSecret = "secret" in originalEvent.detail.data;
    const runner = runtime.run.getRunner(tab.id);
    if (!runner) {
      throw new Error("Can't send input, no runner");
    }
    if (isSecret) {
      secretsHelper.receiveSecrets(originalEvent);
      if (secretsHelper.hasAllSecrets() && !runner?.running()) {
        const secrets = secretsHelper.getSecrets();
        runner?.run(secrets);
      }
    } else {
      const data = originalEvent.detail.data as InputValues;
      if (!runner.running()) {
        runner.run(data);
      }
    }

    return false;
  },
};

export const RenameRoute: EventRoute<"board.rename"> = {
  event: "board.rename",

  async do({ tab, runtime, originalEvent }) {
    runtime.shell.setPageTitle(originalEvent.detail.title);
    await runtime.edit.updateBoardTitleAndDescription(
      tab,
      originalEvent.detail.title,
      originalEvent.detail.description
    );
    return false;
  },
};
