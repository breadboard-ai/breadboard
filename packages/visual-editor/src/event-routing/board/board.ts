/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { InputValues, ok } from "@google-labs/breadboard";
import { RuntimeSnackbarEvent } from "../../runtime/events";
import { parseUrl } from "@breadboard-ai/shared-ui/utils/urls.js";
import { StateEvent } from "@breadboard-ai/shared-ui/events/events.js";

export const RunRoute: EventRoute<"board.run"> = {
  event: "board.run",

  async do({ tab, runtime, settings, askUserToSignInIfNeeded }) {
    if (!tab) {
      console.warn(`Unable to prepare run: no Tab provided`);
      return false;
    }
    if (!settings) {
      console.warn(`Unable to prepare run: no settings store provided`);
      return false;
    }
    if (!(await askUserToSignInIfNeeded())) {
      return false;
    }

    runtime.edit.sideboards.discardTasks();

    if (!runtime.run.hasRun(tab)) {
      console.warn(`Unexpected missing run, preparing a run ...`);
      const preparingRun = await runtime.prepareRun(tab, settings);
      if (!ok(preparingRun)) {
        console.warn(preparingRun.$error);
        return false;
      }
    }

    runtime.run.runBoard(tab);
    return false;
  },
};

export const LoadRoute: EventRoute<"board.load"> = {
  event: "board.load",

  async do({ runtime, originalEvent, uiState }) {
    runtime.router.go({
      page: "graph",
      mode: uiState.mode,
      flow: originalEvent.detail.url,
      resourceKey: undefined,
      shared: originalEvent.detail.shared,
      dev: parseUrl(window.location.href).dev,
    });
    return false;
  },
};

export const UndoRoute: EventRoute<"board.undo"> = {
  event: "board.undo",

  async do({ runtime, tab }) {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return false;
    }

    runtime.edit.undo(tab);
    return false;
  },
};

export const RedoRoute: EventRoute<"board.redo"> = {
  event: "board.redo",

  async do({ runtime, tab }) {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return false;
    }

    runtime.edit.redo(tab);
    return false;
  },
};

export const TogglePinRoute: EventRoute<"board.togglepin"> = {
  event: "board.togglepin",

  async do({ runtime, originalEvent }) {
    runtime.board.setPinnedStatus(
      originalEvent.detail.url,
      originalEvent.detail.status
    );
    return false;
  },
};

export const StopRoute: EventRoute<"board.stop"> = {
  event: "board.stop",

  async do({ tab, runtime, originalEvent, settings }) {
    if (!tab) {
      return false;
    }

    if (tab.finalOutputValues) {
      // Special case. We are displaying a fixed final result screen.
      tab.finalOutputValues = undefined;
      const url = new URL(document.URL);
      if (url.searchParams.has("results")) {
        url.searchParams.delete("results");
        history.pushState(null, "", url);
      }
      const projectState = runtime.run.state.getOrCreateProjectState(
        tab.mainGraphId
      );
      projectState?.resetRun();
      return true;
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
      if (!settings) {
        console.warn(`No settings, unable to prepare next run.`);
      } else {
        const preparingNextRun = await runtime.prepareRun(tab, settings);
        if (!ok(preparingNextRun)) {
          console.warn(preparingNextRun.$error);
        }
      }
    }

    return true;
  },
};

export const RestartRoute: EventRoute<"board.restart"> = {
  event: "board.restart",

  async do({
    tab,
    runtime,
    settings,
    secretsHelper,
    googleDriveClient,
    uiState,
    askUserToSignInIfNeeded,
  }) {
    await StopRoute.do({
      tab,
      runtime,
      originalEvent: new StateEvent({
        eventType: "board.stop",
        clearLastRun: true,
      }),
      settings,
      secretsHelper,
      googleDriveClient,
      uiState,
      askUserToSignInIfNeeded,
    });
    await RunRoute.do({
      tab,
      runtime,
      originalEvent: new StateEvent({
        eventType: "board.run",
      }),
      settings,
      secretsHelper,
      googleDriveClient,
      uiState,
      askUserToSignInIfNeeded,
    });
    return false;
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

  async do({ tab, runtime, originalEvent, uiState }) {
    uiState.blockingAction = true;
    runtime.shell.setPageTitle(originalEvent.detail.title);
    await runtime.edit.updateBoardTitleAndDescription(
      tab,
      originalEvent.detail.title,
      originalEvent.detail.description
    );
    uiState.blockingAction = false;
    return false;
  },
};

export const CreateRoute: EventRoute<"board.create"> = {
  event: "board.create",

  async do({ tab, runtime, uiState, originalEvent }) {
    const boardServerName = uiState.boardServer;
    const location = uiState.boardLocation;
    const fileName = globalThis.crypto.randomUUID();

    uiState.blockingAction = true;
    const result = await runtime.board.saveAs(
      boardServerName,
      location,
      fileName,
      originalEvent.detail.graph,
      originalEvent.detail.messages.start !== "",
      originalEvent.detail.messages
    );
    uiState.blockingAction = false;

    if (!result?.url) {
      return false;
    }

    runtime.router.go(
      {
        page: "graph",
        // Ensure we always go back to the canvas when a board is created.
        mode: "canvas",
        flow: result.url.href,
        // Resource key not required because we know the current user created it.
        resourceKey: undefined,
        dev: parseUrl(window.location.href).dev,
      },
      tab?.id,
      originalEvent.detail.editHistoryCreator
    );

    return false;
  },
};

export const RemixRoute: EventRoute<"board.remix"> = {
  event: "board.remix",

  async do(deps) {
    const { runtime, originalEvent, uiState } = deps;
    uiState.blockingAction = true;

    // Immediately acknowledge the user's action with a snackbar. This will be
    // superseded by another snackbar in the "board.create" route, but if it
    // takes any amount of time to get the latest version of the graph from the
    // store the user will at least have this acknowledgment.
    runtime.dispatchEvent(
      new RuntimeSnackbarEvent(
        globalThis.crypto.randomUUID(),
        originalEvent.detail.messages.start,
        BreadboardUI.Types.SnackType.PENDING,
        [],
        true,
        true // Replace existing snackbars.
      )
    );

    const graphStore = runtime.board.getGraphStore();
    const addResult = graphStore.addByURL(originalEvent.detail.url, [], {});
    const graph = structuredClone(
      (await graphStore.getLatest(addResult.mutable)).graph
    );
    graph.title = `${graph.title ?? "Untitled"} Remix`;

    await CreateRoute.do({
      ...deps,
      originalEvent: new BreadboardUI.Events.StateEvent({
        eventType: "board.create",
        editHistoryCreator: { role: "user" },
        graph,
        messages: originalEvent.detail.messages,
      }),
    });

    uiState.blockingAction = false;

    return false;
  },
};

export const DeleteRoute: EventRoute<"board.delete"> = {
  event: "board.delete",

  async do(deps) {
    const { tab, runtime, originalEvent, uiState } = deps;
    const boardServer = runtime.board.getBoardServerForURL(
      new URL(originalEvent.detail.url)
    );
    if (!boardServer) {
      return false;
    }

    if (!confirm(originalEvent.detail.messages.query)) {
      return false;
    }

    uiState.blockingAction = true;
    await runtime.board.delete(
      boardServer.name,
      originalEvent.detail.url,
      originalEvent.detail.messages
    );
    uiState.blockingAction = false;

    if (tab) {
      runtime.select.deselectAll(tab.id, runtime.select.generateId());
    }

    return false;
  },
};

export const ReplaceRoute: EventRoute<"board.replace"> = {
  event: "board.replace",

  async do(deps) {
    const { tab, runtime, originalEvent, googleDriveClient } = deps;

    const { replacement } = originalEvent.detail;
    runtime.util.applyDefaultThemeInformationIfNonePresent(replacement);
    await runtime.util.createAppPaletteIfNeeded(replacement, googleDriveClient);

    await runtime.edit.replaceGraph(
      tab,
      replacement,
      originalEvent.detail.creator
    );

    return false;
  },
};
