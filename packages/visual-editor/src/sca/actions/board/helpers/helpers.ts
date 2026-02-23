/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppController } from "../../../controller/controller.js";
import type { AppServices } from "../../../services/services.js";
import { parseUrl } from "../../../../ui/navigation/urls.js";

export {
  canParse,
  resolveUrl,
  addResourceKeyIfPresent,
} from "./resolve-url.js";
export {
  canLoad,
  loadGraph,
  type LoadGraphDeps,
  type LoadGraphResult,
  type CanLoadResult,
} from "./load-graph.js";
export {
  prepareGraph,
  validateSubGraphId,
  renameLegacyMainBoard,
  type PrepareGraphOptions,
  type PrepareGraphResult,
} from "./prepare-graph.js";
export {
  checkVersion,
  type VersionInfo,
  type CheckVersionDeps,
} from "./check-version.js";
export {
  loadResults,
  type LoadResultsResult,
  type RunResults,
} from "./load-results.js";
export {
  initializeEditor,
  resetEditor,
  type InitializeEditorOptions,
  type InitializeEditorResult,
} from "./initialize-editor.js";

/**
 * Navigates to a newly created board and notifies the embedder.
 *
 * Shared by `onCreate` and `onRemix` — both create a new board, navigate to
 * its canvas view, and inform the shell host that a new board ID was created.
 *
 * @param controller The app controller (for router navigation)
 * @param services The app services (for embed handler notification)
 * @param url The URL of the newly created board
 */
export function navigateToNewBoard(
  controller: AppController,
  services: AppServices,
  url: URL
): void {
  const { lite, dev } = parseUrl(window.location.href);

  controller.router.go({
    page: "graph",
    // Ensure we always go back to the canvas when a board is created.
    mode: "canvas",
    // Ensure that we correctly preserve the "lite" mode.
    lite,
    flow: url.href,
    // Resource key not required because we know the current user created it.
    resourceKey: undefined,
    dev,
    guestPrefixed: true,
  });
  services.embedHandler?.sendToEmbedder({
    type: "board_id_created",
    id: url.href,
  });
}
