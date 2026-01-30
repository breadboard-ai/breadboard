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

import { StateEvent } from "../../ui/events/events.js";
import { parseUrl } from "../../ui/utils/urls.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { Utils } from "../../sca/utils.js";
import { GraphUtils } from "../../utils/graph-utils.js";

export const RunRoute: EventRoute<"board.run"> = {
  event: "board.run",

  async do({ tab, settings, askUserToSignInIfNeeded, boardServer, sca }) {
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

    if (!sca.controller.run.main.hasRunner) {
      console.warn(`Run not prepared - runner not available`);
      return false;
    }

    // b/452677430 - Check for consent before running shared Opals that
    // use the get_webpage tool, as this could be a data exfiltration vector
    if (
      (await sca.controller.global.flags.flags()).requireConsentForGetWebpage
    ) {
      const editor = sca.controller.editor.graph.editor;
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

    sca.controller.run.main.start();
    return false;
  },
};

export const LoadRoute: EventRoute<"board.load"> = {
  event: "board.load",

  async do({ originalEvent, sca }) {
    if (Utils.Helpers.isHydrating(() => sca.controller.global.main.mode)) {
      await sca.controller.global.main.isHydrated;
    }

    sca.controller.router.go({
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

  async do({ tab, sca }) {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return false;
    }

    sca.actions.graph.undo();
    return false;
  },
};

export const RedoRoute: EventRoute<"board.redo"> = {
  event: "board.redo",

  async do({ sca, tab }) {
    if (tab?.readOnly || !tab?.graphIsMine) {
      return false;
    }

    sca.actions.graph.redo();
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

  async do({ tab, runtime, sca, settings }) {
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
    }

    // Stop the run via controller
    sca.controller.run.main.stop();

    // Reset project run state
    runtime.state.project?.resetRun();

    // Prepare the next run
    const url = tab.graph.url;
    if (url && settings) {
      sca.actions.run.prepare({
        graph: tab.graph,
        url,
        settings,
        fetchWithCreds: sca.services.fetchWithCreds,
        flags: sca.controller.global.flags,
        getProjectRunState: () => runtime.state.project?.run,
        connectToProject: (runner, fileSystem, abortSignal) => {
          runtime.state.project?.connectHarnessRunner(
            runner,
            fileSystem,
            abortSignal
          );
        },
      });
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

  async do({ tab, settings, originalEvent, sca }) {
    if (!settings || !tab) {
      return false;
    }

    const runner = sca.controller.run.main.runner;
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

  async do({ originalEvent, sca }) {
    try {
      sca.controller.global.main.blockingAction = true;
      // Page title is now handled by the page title trigger in SCA
      await sca.actions.graph.updateBoardTitleAndDescription(
        originalEvent.detail.title,
        originalEvent.detail.description
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
    sca,
    originalEvent,
    askUserToSignInIfNeeded,
    embedHandler,
  }) {
    if ((await askUserToSignInIfNeeded()) !== "success") {
      // The user didn't sign in, so hide any snackbars.
      sca.controller.global.snackbars.unsnackbar();
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    const result = await sca.actions.board.saveAs(
      originalEvent.detail.graph,
      originalEvent.detail.messages
    );
    sca.controller.global.main.blockingAction = false;

    if (!result?.url) {
      return false;
    }

    const { lite, dev } = parseUrl(window.location.href);

    sca.controller.router.go({
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
    });
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
    const { originalEvent, sca, embedHandler } = deps;

    sca.controller.global.main.blockingAction = true;

    // Remix action handles snackbar, graph resolution, and saveAs
    const result = await sca.actions.board.remix(
      originalEvent.detail.url,
      originalEvent.detail.messages
    );
    sca.controller.global.main.blockingAction = false;

    if (!result?.success) {
      return false;
    }

    const { lite, dev } = parseUrl(window.location.href);

    sca.controller.router.go({
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
    });
    embedHandler?.sendToEmbedder({
      type: "board_id_created",
      id: result.url.href,
    });

    return false;
  },
};

export const DeleteRoute: EventRoute<"board.delete"> = {
  event: "board.delete",

  async do(deps) {
    const { tab, runtime, originalEvent, sca } = deps;
    if (!confirm(originalEvent.detail.messages.query)) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    await sca.actions.board.deleteBoard(
      originalEvent.detail.url,
      originalEvent.detail.messages
    );
    sca.controller.home.recent.remove(originalEvent.detail.url);
    await sca.controller.home.recent.isSettled;
    sca.controller.global.main.blockingAction = false;

    if (tab) {
      runtime.select.deselectAll(tab.id, runtime.select.generateId());
    }

    if (sca.controller.router.parsedUrl.page === "home") return false;

    const { lite, dev } = parseUrl(window.location.href);
    sca.controller.router.go({
      page: "home",
      lite,
      dev,
      guestPrefixed: true,
    });

    return false;
  },
};

export const ReplaceRoute: EventRoute<"board.replace"> = {
  event: "board.replace",

  async do(deps) {
    const { tab, originalEvent, googleDriveClient, sca } = deps;

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
      GraphUtils.applyDefaultThemeInformationIfNonePresent(replacement);
      await GraphUtils.createAppPaletteIfNeeded(
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

    await sca.actions.graph.replace(replacement, originalEvent.detail.creator);

    return false;
  },
};
