/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types.js";

import {
  ConsentType,
  ConsentUIType,
  GraphMetadata,
  InputValues,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import {
  RuntimeSnackbarEvent,
  RuntimeUnsnackbarEvent,
} from "../../runtime/events.js";
import { StateEvent } from "../../ui/events/events.js";
import * as BreadboardUI from "../../ui/index.js";
import { parseUrl } from "../../ui/utils/urls.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { Utils } from "../../sca/utils.js";

export const RunRoute: EventRoute<"board.run"> = {
  event: "board.run",

  async do({
    tab,
    runtime,
    settings,
    askUserToSignInIfNeeded,
    boardServer,
    sca,
  }) {
    if (!tab) {
      console.warn(`Unable to prepare run: no Tab provided`);
      return false;
    }
    if (!settings) {
      console.warn(`Unable to prepare run: no settings store provided`);
      return false;
    }
    if ((await askUserToSignInIfNeeded()) !== "success") {
      return false;
    }

    if (!runtime.run.hasRun(tab)) {
      console.warn(`Unexpected missing run, preparing a run ...`);
      const preparingRun = await runtime.prepareRun(tab, settings);
      if (!ok(preparingRun)) {
        console.warn(preparingRun.$error);
        return false;
      }
    }

    // b/452677430 - Check for consent before running shared Opals that
    // use the get_webpage tool, as this could be a data exfiltration vector
    if ((await runtime.flags.flags()).requireConsentForGetWebpage) {
      const editor = runtime.edit.getEditor(tab);
      const graph = editor?.inspect("");
      const url = tab.graph.url;
      const isGalleryApp =
        boardServer instanceof GoogleDriveBoardServer &&
        url &&
        boardServer.galleryGraphs.has(url);
      if (
        !isGalleryApp &&
        !tab.graphIsMine &&
        graph?.usesTool("embed://a2/tools.bgl.json#module:get-webpage")
      ) {
        if (
          !(await sca.controller.global.consent.queryConsent(
            {
              type: ConsentType.GET_ANY_WEBPAGE,
              scope: {},
              graphUrl: tab.graph.url!,
            },
            ConsentUIType.IN_APP
          ))
        ) {
          return false;
        }
      }
    }

    runtime.run.runBoard(tab);
    return false;
  },
};

export const LoadRoute: EventRoute<"board.load"> = {
  event: "board.load",

  async do({ runtime, originalEvent, sca }) {
    if (Utils.Helpers.isHydrating(() => sca.controller.global.main.mode)) {
      await sca.controller.global.main.isHydrated;
    }

    runtime.router.go({
      page: "graph",
      mode: sca.controller.global.main.mode,
      flow: originalEvent.detail.url,
      resourceKey: undefined,
      shared: originalEvent.detail.shared,
      dev: parseUrl(window.location.href).dev,
      guestPrefixed: true,
    });
    sca.controller.home.recent.add({ url: originalEvent.detail.url });
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

  async do({ sca, originalEvent }) {
    sca.controller.home.recent.setPin(
      originalEvent.detail.url,
      originalEvent.detail.status === "pin"
    );
    return false;
  },
};

export const StopRoute: EventRoute<"board.stop"> = {
  event: "board.stop",

  async do({ tab, runtime, settings }) {
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

        runtime.state.project?.resetRun();
      }
    }

    const tabId = tab?.id ?? null;
    const abortController = runtime.run.getAbortSignal(tabId);
    if (!abortController) {
      return false;
    }

    abortController.abort("Run stopped");

    await runtime.run.clearLastRun(tabId, tab?.graph.url);
    if (!settings) {
      console.warn(`No settings, unable to prepare next run.`);
    } else {
      const preparingNextRun = await runtime.prepareRun(tab, settings);
      if (!ok(preparingNextRun)) {
        console.warn(preparingNextRun.$error);
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
    googleDriveClient,
    sca,
    askUserToSignInIfNeeded,
    boardServer,
    actionTracker,
  }) {
    await StopRoute.do({
      tab,
      runtime,
      originalEvent: new StateEvent({
        eventType: "board.stop",
      }),
      settings,
      googleDriveClient,
      sca,
      askUserToSignInIfNeeded,
      boardServer,
    });
    actionTracker?.runApp(tab?.graph.url, "console");
    await RunRoute.do({
      tab,
      runtime,
      originalEvent: new StateEvent({
        eventType: "board.run",
      }),
      settings,
      googleDriveClient,
      sca,
      askUserToSignInIfNeeded,
      boardServer,
    });
    return false;
  },
};

export const InputRoute: EventRoute<"board.input"> = {
  event: "board.input",

  async do({ tab, runtime, settings, originalEvent }) {
    if (!settings || !tab) {
      return false;
    }

    const runner = runtime.run.getRunner(tab.id);
    if (!runner) {
      throw new Error("Can't send input, no runner");
    }

    const data = originalEvent.detail.data as InputValues;
    if (!runner.running()) {
      runner.resumeWithInputs(data);
    }

    return false;
  },
};

export const RenameRoute: EventRoute<"board.rename"> = {
  event: "board.rename",

  async do({ tab, runtime, originalEvent, sca }) {
    try {
      sca.controller.global.main.blockingAction = true;
      runtime.shell.setPageTitle(originalEvent.detail.title);
      await runtime.edit.updateBoardTitleAndDescription(
        tab,
        originalEvent.detail.title,
        originalEvent.detail.description
      );

      // SCA Action - currently inert.
      await sca.actions.graph.edit(
        [
          {
            type: "changegraphmetadata",
            title: originalEvent.detail.title || undefined,
            description: originalEvent.detail.description || undefined,
            graphId: "",
          },
        ],
        "Updating title and description"
      );
    } finally {
      sca.controller.global.main.blockingAction = false;
    }
    return false;
  },
};

export const CreateRoute: EventRoute<"board.create"> = {
  event: "board.create",

  async do({
    tab,
    runtime,
    sca,
    originalEvent,
    askUserToSignInIfNeeded,
    embedHandler,
  }) {
    if ((await askUserToSignInIfNeeded()) !== "success") {
      // The user didn't sign in, so hide any snackbars.
      runtime.dispatchEvent(new RuntimeUnsnackbarEvent());
      return false;
    }

    const boardServerName = sca.controller.global.main.boardServer;
    const location = sca.controller.global.main.boardLocation;
    const fileName = globalThis.crypto.randomUUID();

    sca.controller.global.main.blockingAction = true;
    const result = await runtime.board.saveAs(
      boardServerName,
      location,
      fileName,
      originalEvent.detail.graph,
      originalEvent.detail.messages.start !== "",
      originalEvent.detail.messages
    );
    sca.controller.global.main.blockingAction = false;

    if (!result?.url) {
      return false;
    }

    const { lite, dev } = parseUrl(window.location.href);

    runtime.router.go(
      {
        page: "graph",
        // Ensure we always go back to the canvas when a board is created.
        mode: "canvas",
        // Ensure that we correctly preserve the "lite" mode.
        lite,
        flow: result.url.href,
        // Resource key not required because we know the current user
        // created it.
        resourceKey: undefined,
        dev,
        guestPrefixed: true,
      },
      tab?.id,
      originalEvent.detail.editHistoryCreator
    );
    embedHandler?.sendToEmbedder({
      type: "board_id_created",
      id: result.url.href,
    });

    return false;
  },
};

export const RemixRoute: EventRoute<"board.remix"> = {
  event: "board.remix",

  async do(deps) {
    const { runtime, originalEvent, sca } = deps;
    sca.controller.global.main.blockingAction = true;

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

    const graphStore = runtime.board.graphStore;
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

    sca.controller.global.main.blockingAction = false;

    return false;
  },
};

export const DeleteRoute: EventRoute<"board.delete"> = {
  event: "board.delete",

  async do(deps) {
    const { tab, runtime, originalEvent, sca } = deps;
    const boardServer = runtime.board.googleDriveBoardServer;
    if (!confirm(originalEvent.detail.messages.query)) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    await runtime.board.delete(
      boardServer.name,
      originalEvent.detail.url,
      originalEvent.detail.messages
    );
    sca.controller.home.recent.remove(originalEvent.detail.url);
    await sca.controller.home.recent.isSettled;
    sca.controller.global.main.blockingAction = false;

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

    const { replacement, theme } = originalEvent.detail;

    if (theme) {
      const metadata: GraphMetadata = (replacement.metadata ??= {});
      metadata.visual ??= {};
      metadata.visual.presentation ??= {};
      metadata.visual.presentation.themes ??= {};

      const id = globalThis.crypto.randomUUID();
      metadata.visual.presentation.themes[id] = theme;
      metadata.visual.presentation.theme = id;
    } else {
      runtime.util.applyDefaultThemeInformationIfNonePresent(replacement);
      await runtime.util.createAppPaletteIfNeeded(
        replacement,
        googleDriveClient
      );
    }

    // If there is a theme applied it shouldn't be possible to revert this to
    // the default theme with a board replacement, so we protect against that
    // here.
    //
    // We instead check the current graph for a splash image, and the
    // replacement as well. If the current graph has a splash image and the
    // replacement does not, we copy the current theme across.
    //
    // TODO: Remove this when the Planner persists the existing theme.
    const currentPresentation = tab?.graph.metadata?.visual?.presentation;
    const currentTheme = currentPresentation?.theme;
    const currentThemes = currentPresentation?.themes;
    const currentThemeHasSplashScreen =
      currentTheme &&
      currentThemes &&
      currentThemes[currentTheme] &&
      currentThemes[currentTheme].splashScreen;

    const replacementPresentation = replacement.metadata?.visual?.presentation;
    const replacementTheme = replacementPresentation?.theme;
    const replacementThemes = replacementPresentation?.themes;
    const replacementThemeHasSplashScreen =
      replacementTheme &&
      replacementThemes &&
      replacementThemes[replacementTheme] &&
      replacementThemes[replacementTheme].splashScreen;

    if (currentThemeHasSplashScreen && !replacementThemeHasSplashScreen) {
      console.log("[board replacement] Persisting existing theme");
      replacementThemes![replacementTheme!] = currentThemes![currentTheme!];
    }

    await runtime.edit.replaceGraph(
      tab,
      replacement,
      originalEvent.detail.creator
    );

    return false;
  },
};
