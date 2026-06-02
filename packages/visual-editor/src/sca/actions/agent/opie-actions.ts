/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Action for creating a new board and optionally starting the Opie
 * (Graph Editing Agent) loop on it.
 *
 * Owns the full sequence: create blank board → save to Drive →
 * navigate to editor → wait for load → optionally start agent loop.
 *
 * When no intent is provided, the board is created with a blank graph
 * and no agent loop is started (purely mechanical creation).
 *
 * When an intent is provided, the agent loop is started with the
 * user's prompt after the board finishes loading.
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import type { AppController } from "../../controller/controller.js";

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction, withUIBlocking } from "../binder.js";
import { blankBoard } from "../../../ui/utils/blank-board.js";
import * as Helpers from "../board/helpers/helpers.js";
import { startGraphEditingAgent } from "./graph-editing-agent-actions.js";
import { SnackType, CreateNewResult } from "../../types.js";
import { reactive } from "../../reactive.js";

import * as Strings from "../../../ui/strings/helper.js";

export { bind };
export { createNew };

const bind = makeAction();
const GlobalStrings = Strings.forSection("Global");

/**
 * Creates a new board and optionally starts the Opie agent loop.
 *
 * **Flow:**
 * 1. Check sign-in
 * 2. Create a blank board via the board server
 * 3. Navigate to the new board
 * 4. Wait for the board to finish loading
 * 5. If an intent is provided, start the Graph Editing Agent loop
 *
 * Uses `Immediate` mode — this action triggers Board.load (Exclusive) via
 * navigation, so it must not hold any coordination slot.
 */
const createNew = asAction(
  "Opie.createNew",
  { mode: ActionMode.Immediate },
  async (intent?: string): Promise<CreateNewResult> => {
    const { controller, services } = bind;

    // 1. Ensure the user is signed in.
    if ((await services.askUserToSignInIfNeeded()) !== "success") {
      return { success: false, reason: "auth-required" };
    }

    let result: CreateNewResult = { success: false, reason: "unknown" };

    await withUIBlocking(controller, async () => {
      // 2. Create a blank board.
      const graph: GraphDescriptor = blankBoard();
      const messages = {
        start: GlobalStrings.from("STATUS_CREATING_PROJECT") || "Creating…",
        end: GlobalStrings.from("STATUS_PROJECT_CREATED") || "Created",
        error:
          GlobalStrings.from("ERROR_UNABLE_TO_CREATE_PROJECT") ||
          "Unable to create",
      };

      const boardServer = services.googleDriveBoardServer;
      if (!boardServer) {
        result = { success: false, reason: "no-board-server" };
        return;
      }

      const ignoredPlaceholderUrl = new URL("http://invalid");
      const createResult = await boardServer.create(
        ignoredPlaceholderUrl,
        graph
      );

      if (!createResult.url) {
        controller.global.snackbars.snackbar(
          messages.error,
          SnackType.ERROR,
          [],
          false,
          undefined,
          true
        );
        result = { success: false, reason: "create-failed" };
        return;
      }

      const url = new URL(createResult.url);

      // 3. Navigate to the new board.
      Helpers.navigateToNewBoard(controller, services, url);

      // 4. Wait for the board to finish loading.
      // The navigation triggers MainBase's URL change handler which calls
      // board.load. We wait for loadState to transition to "Loaded".
      await waitForLoadState(controller);

      result = { success: true, url };
    });

    // 5. If an intent was provided, start the Opie agent loop.
    if (result.success && intent) {
      const agent = controller.editor.graphEditingAgent;
      agent.open = true;
      agent.addMessage("user", intent);
      startGraphEditingAgent(intent);
    }

    return result;
  }
);

/**
 * Waits for the global loadState to transition to "Loaded".
 *
 * Uses a reactive effect to listen to changes on the loadState signal,
 * with a timeout guard to avoid hanging indefinitely.
 */
function waitForLoadState(controller: AppController): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const TIMEOUT_MS = 15_000;
    const timer = setTimeout(() => {
      dispose();
      reject(new Error("Timed out waiting for board to load"));
    }, TIMEOUT_MS);

    const dispose = reactive(() => {
      if (controller.global.main.loadState === "Loaded") {
        clearTimeout(timer);
        resolve();
        dispose();
      }
    });
  });
}
