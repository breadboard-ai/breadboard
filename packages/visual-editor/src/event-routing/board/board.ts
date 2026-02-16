/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FIXME: Legacy board event routes. These still depend on the legacy runtime
 * (e.g. runtime.project, tab) which is not yet available through SCA services.
 * Migrate to SCA board-actions.ts (using stateEventTrigger) once the runtime
 * dependency is resolved, then delete this file.
 */

import { EventRoute } from "../types.js";

import {
  ConsentType,
  ConsentUIType,
  InputValues,
  SimplifiedProjectRunState,
} from "@breadboard-ai/types";

import { StateEvent } from "../../ui/events/events.js";
import { parseUrl } from "../../ui/utils/urls.js";
import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { provideInput } from "../../sca/actions/run/helpers/input-queue.js";

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
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

    if (!sca.controller.run.main.runner) {
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

    sca.actions.run.start();
    return false;
  },
};

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const StopRoute: EventRoute<"board.stop"> = {
  event: "board.stop",

  async do({ tab, sca, settings }) {
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
    sca.actions.run.stop();

    // Prepare the next run
    const url = tab.graph.url;
    if (url && settings) {
      sca.actions.run.prepare({
        graph: tab.graph,
        url,
        settings,
        fetchWithCreds: sca.services.fetchWithCreds,
        flags: sca.controller.global.flags,
        getProjectRunState: () =>
          ({
            console: sca.controller.run.main.console,
            app: { screens: sca.controller.run.screen.screens },
          }) as unknown as SimplifiedProjectRunState,
      });
    }

    return true;
  },
};

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const RestartRoute: EventRoute<"board.restart"> = {
  event: "board.restart",

  async do({
    tab,
    settings,
    googleDriveClient,
    sca,
    askUserToSignInIfNeeded,
    boardServer,
    actionTracker,
  }) {
    await StopRoute.do({
      tab,
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

    const data = originalEvent.detail.data as InputValues;
    provideInput(data, sca.controller.run);
    return false;
  },
};

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const CreateRoute: EventRoute<"board.create"> = {
  event: "board.create",

  async do({ sca, originalEvent, askUserToSignInIfNeeded }) {
    if ((await askUserToSignInIfNeeded()) !== "success") {
      // The user didn't sign in, so hide any snackbars.
      sca.controller.global.snackbars.unsnackbar();
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    try {
      const result = await sca.actions.board.saveAs(
        originalEvent.detail.graph,
        originalEvent.detail.messages
      );

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
      sca.services.embedHandler?.sendToEmbedder({
        type: "board_id_created",
        id: result.url.href,
      });
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const RemixRoute: EventRoute<"board.remix"> = {
  event: "board.remix",

  async do(deps) {
    const { originalEvent, sca } = deps;

    sca.controller.global.main.blockingAction = true;
    try {
      // Remix action handles snackbar, graph resolution, and saveAs
      const result = await sca.actions.board.remix(
        originalEvent.detail.url,
        originalEvent.detail.messages
      );

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
      sca.services.embedHandler?.sendToEmbedder({
        type: "board_id_created",
        id: result.url.href,
      });
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const DeleteRoute: EventRoute<"board.delete"> = {
  event: "board.delete",

  async do(deps) {
    const { originalEvent, sca } = deps;
    if (!confirm(originalEvent.detail.messages.query)) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.board.deleteBoard(
        originalEvent.detail.url,
        originalEvent.detail.messages
      );
      sca.controller.home.recent.remove(originalEvent.detail.url);
      await sca.controller.home.recent.isSettled;
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    sca.controller.editor.selection.deselectAll();

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
