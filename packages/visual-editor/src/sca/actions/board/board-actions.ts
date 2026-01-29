/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditHistoryCreator,
  GraphDescriptor,
  OutputValues,
} from "@breadboard-ai/types";
import { SnackType, type SnackbarUUID } from "../../../ui/types/types.js";
import { Utils } from "../../utils.js";
import { makeAction } from "../binder.js";
import * as Helpers from "./helpers/helpers.js";

export const bind = makeAction();

const LABEL = "Board Actions";

/**
 * @fileoverview
 *
 * Contains Actions for loading and saving graphs.
 *
 * Note: Currently these Actions does not require the graphStore service because
 * we keep the editor instance on the graphController. This is so that it is a
 * stable reference on which we can listen to legacy events. However, the aim is
 * to remove events in favor of Signals, which, when complete, will mean that
 * edits can get a fresh editor from the graphStore service here.
 */

/**
 * Saves the current board to the board server.
 *
 * @param messages Optional messages for user acknowledgment snackbars
 * @throws Error if called without an editor (programming error)
 * @returns Promise resolving to save result, or undefined if save is not applicable
 */
export async function save(
  messages?: { start: string; end: string } | null
): Promise<{ result: boolean } | undefined> {
  const { controller, services } = bind;
  const { editor, url, readOnly } = controller.editor.graph;
  const logger = Utils.Logging.getLogger(controller);
  const snackbars = controller.global.snackbars;

  // Guard: These are programming errors - the trigger should check these
  if (!editor) {
    throw new Error("save() called without an active editor");
  }

  // Guard: No URL means the graph hasn't been persisted yet - bail silently
  if (!url) {
    return undefined;
  }

  // Guard: Read-only graphs cannot be saved - bail silently
  if (readOnly) {
    return undefined;
  }

  const boardServer = services.googleDriveBoardServer;
  const boardUrl = new URL(url);

  // Check if board server can save this URL - bail silently if not
  const capabilities = boardServer.canProvide(boardUrl);
  if (!capabilities || !capabilities.save) {
    return undefined;
  }

  // Get the current graph from the editor
  const graph = editor.raw();
  if (!graph) {
    throw new Error("save() called but editor has no graph");
  }

  // User-initiated save: show snackbar
  let snackbarId: SnackbarUUID | undefined;
  if (messages) {
    snackbarId = snackbars.snackbar(
      messages.start,
      SnackType.PENDING,
      [],
      true, // persistent
      undefined,
      true // replaceAll
    );
  }

  try {
    // The board server handles debouncing/queueing internally
    const result = await boardServer.save(boardUrl, graph, !!messages);

    // Update snackbar on success
    if (snackbarId && messages) {
      snackbars.update(snackbarId, messages.end, SnackType.INFORMATION);
    }

    return result;
  } catch (error) {
    logger.log(
      Utils.Logging.Formatter.warning(
        `Failed to save board: ${error instanceof Error ? error.message : String(error)}`
      ),
      LABEL
    );

    // Update snackbar on error (if we had one)
    if (snackbarId) {
      snackbars.unsnackbar(snackbarId);
    }

    return { result: false };
  }
}

/**
 * State to prevent concurrent saveAs operations.
 */
let isSavingAs = false;

/**
 * Saves the current graph as a new board.
 *
 * @param graph The graph descriptor to save
 * @param messages Snackbar messages for user feedback
 * @returns Promise resolving to result with new URL, or null if operation can't proceed
 */
export async function saveAs(
  graph: GraphDescriptor,
  messages: { start: string; end: string; error: string }
): Promise<{ result: boolean; url?: URL } | null> {
  const { controller, services } = bind;
  const snackbars = controller.global.snackbars;

  // Prevent concurrent saveAs operations
  if (isSavingAs) {
    return null;
  }

  isSavingAs = true;

  const snackbarId = snackbars.snackbar(
    messages.start,
    SnackType.PENDING,
    [],
    true, // persistent
    undefined,
    true // replaceAll
  );

  const fail = { result: false, error: "Unable to save", url: undefined };

  const boardServer = services.googleDriveBoardServer;
  if (!boardServer) {
    isSavingAs = false;
    snackbars.update(snackbarId, messages.error, SnackType.ERROR);
    return fail;
  }

  try {
    // A placeholder URL since create() doesn't actually use it
    const ignoredPlaceholderUrl = new URL("http://invalid");

    // Replace pointers with inline data so that copies get created when saving
    const copiedGraph = await boardServer.deepCopy(
      ignoredPlaceholderUrl,
      graph
    );

    const createResult = await boardServer.create(
      ignoredPlaceholderUrl,
      copiedGraph
    );

    if (!createResult.url) {
      isSavingAs = false;
      snackbars.update(snackbarId, messages.error, SnackType.ERROR);
      return fail;
    }

    // Clear all snackbars on success (matching original behavior)
    snackbars.unsnackbar();

    return { result: true, url: new URL(createResult.url) };
  } catch {
    return fail;
  } finally {
    snackbars.unsnackbar();
    isSavingAs = false;
  }
}

/**
 * Result type for the remix action.
 */
export type RemixResult =
  | { success: true; url: URL }
  | { success: false; reason: "no-graph" | "save-failed" };

/**
 * Remixes a graph by creating a copy with " Remix" appended to the title
 * and saving it as a new board.
 *
 * This action:
 * 1. Shows an immediate snackbar to acknowledge the user's action
 * 2. Resolves the graph from editor (if URL matches) or graph store
 * 3. Clones the graph with " Remix" appended to the title
 * 4. Saves the new graph via saveAs
 *
 * @param url The URL of the graph to remix
 * @param messages Snackbar messages for user feedback
 * @returns The save result with new URL, or an error result
 */
export async function remix(
  url: string,
  messages: { start: string; end: string; error: string }
): Promise<RemixResult> {
  const { controller, services } = bind;
  const graphController = controller.editor.graph;
  const snackbars = controller.global.snackbars;

  const logger = Utils.Logging.getLogger(controller);
  const LABEL = "Board Actions";

  // Immediately acknowledge the user's action with a snackbar.
  // This will be superseded by saveAs, but provides instant feedback.
  snackbars.snackbar(
    messages.start,
    SnackType.PENDING,
    [],
    true,
    undefined,
    true // Replace existing snackbars.
  );

  // Resolve the graph to remix
  const currentGraph = graphController.editor?.raw();
  let graph: GraphDescriptor;

  // First check if the currently open graph matches the remix URL.
  // This handles the common case of remixing from the header and avoids
  // URL mismatch issues (e.g., resourcekey param removed by loader).
  if (currentGraph && graphController.url === url) {
    logger.log(Utils.Logging.Formatter.verbose("Using current graph"), LABEL);
    graph = structuredClone(currentGraph);
  } else {
    // Fall back to loading from the store (for gallery remixes, etc.)
    logger.log(Utils.Logging.Formatter.verbose("Using graph store"), LABEL);

    const graphStore = services.graphStore;
    const addResult = graphStore.addByURL(url, [], {});
    const mutable = await graphStore.getLatest(addResult.mutable);

    if (!mutable.graph || mutable.graph.nodes.length === 0) {
      // Empty graph means the load failed - likely URL mismatch
      snackbars.snackbar(
        messages.error,
        SnackType.ERROR,
        [],
        false,
        undefined,
        true
      );
      return { success: false, reason: "no-graph" };
    }

    graph = structuredClone(mutable.graph);
  }

  // Append " Remix" to the title
  graph.title = `${graph.title ?? "Untitled"} Remix`;

  // Save as a new board
  const saveResult = await saveAs(graph, messages);

  if (!saveResult?.result || !saveResult.url) {
    return { success: false, reason: "save-failed" };
  }

  return { success: true, url: saveResult.url };
}

/**
 * Deletes a board from the board server.
 *
 * @param url The URL of the board to delete
 * @param messages Snackbar messages for user feedback
 * @returns Promise resolving to the delete result
 */
export async function deleteBoard(
  url: string,
  messages: { start: string; end: string; error: string }
): Promise<{ result: boolean }> {
  const { controller, services } = bind;
  const snackbars = controller.global.snackbars;

  const snackbarId = snackbars.snackbar(
    messages.start,
    SnackType.PENDING,
    [],
    true, // persistent
    undefined,
    true // replaceAll
  );

  const fail = { result: false, error: "Unable to delete" };

  const boardServer = services.googleDriveBoardServer;
  if (!boardServer) {
    snackbars.update(snackbarId, messages.error, SnackType.ERROR);
    return fail;
  }

  const result = await boardServer.delete(new URL(url));

  // Update snackbar with success message
  snackbars.update(snackbarId, messages.end, SnackType.INFORMATION);

  return result;
}

/**
 * Options for the load action.
 */
export interface LoadOptions {
  /** Base URL to resolve relative URLs against */
  baseUrl?: string | null;
  /** Module ID to focus on (for imperative graphs) */
  moduleId?: string | null;
  /** Subgraph ID to focus on */
  subGraphId?: string | null;
  /** Creator info for edit history */
  creator?: EditHistoryCreator;
  /** Google Drive file ID containing run results */
  resultsFileId?: string;
}

/**
 * Result type for the load action.
 */
export type LoadResult =
  | { success: true }
  | {
    success: false;
    reason:
    | "invalid-url"
    | "auth-required"
    | "load-failed"
    | "race-condition";
  };

// The helpers used for the function below are tested, but to test the function
// itself we need to mock the controller and services, which is a lot of mocks
// for not a lot of reassurance. So we ignore the body for coverage reporting.

/* c8 ignore start */

/**
 * Loads a board from a URL.
 *
 * This action:
 * 1. Resolves the URL relative to the current board
 * 2. Loads the graph from the URL
 * 3. Prepares the graph (validation, theme, palette)
 * 4. Checks for newer versions (shared graphs)
 * 5. Loads edit history and final output values if applicable
 * 6. Initializes the editor with the graph
 *
 * @param url The URL of the board to load
 * @param options Optional load configuration
 * @returns Load result indicating success or failure reason
 */
export async function load(
  url: string,
  options: LoadOptions = {}
): Promise<LoadResult> {
  const { controller, services } = bind;
  const logger = Utils.Logging.getLogger(controller);
  const LABEL = "Board Actions";

  // Track the URL at start to detect race conditions
  const urlAtStart = controller.editor.graph.url;

  // 1. Resolve URL relative to current board
  const resolvedUrl = Helpers.resolveUrl(url, options.baseUrl ?? null);

  if (!resolvedUrl || !Helpers.canParse(resolvedUrl)) {
    logger.log(Utils.Logging.Formatter.warning(`Invalid URL: ${url}`), LABEL);
    return { success: false, reason: "invalid-url" };
  }

  // 2. Load the graph
  const loadResult = await Helpers.loadGraph(resolvedUrl, urlAtStart, {
    loader: services.loader,
    signinAdapter: services.signinAdapter,
    boardServer: services.googleDriveBoardServer,
  });

  if (!loadResult.success) {
    logger.log(
      Utils.Logging.Formatter.warning(`Failed to load: ${loadResult.reason}`),
      LABEL
    );
    return { success: false, reason: loadResult.reason };
  }

  const { graph, boardServer } = loadResult;

  // 3. Prepare the graph
  const prepared = await Helpers.prepareGraph(graph, {
    moduleId: options.moduleId,
    subGraphId: options.subGraphId,
    googleDriveClient: services.googleDriveClient,
  });

  // 4. Check for race condition - URL changed during async operations
  if (controller.editor.graph.url !== urlAtStart) {
    logger.log(
      Utils.Logging.Formatter.info("URL changed during load, aborting"),
      LABEL
    );
    return { success: false, reason: "race-condition" };
  }

  // 5. Check version for shared graphs
  const isMineCheck = (u: string | undefined) =>
    u ? boardServer.isMine(new URL(u)) : false;
  const versionInfo = await Helpers.checkVersion(
    graph.url,
    boardServer,
    controller.board.main,
    { isMine: isMineCheck }
  );

  const version = versionInfo?.version ?? -1;
  const lastLoadedVersion = versionInfo?.lastLoadedVersion ?? -1;

  // 6. Load edit history from BoardController
  await controller.board.main.isHydrated;
  const history = controller.board.main.getEditHistory(resolvedUrl);

  // 7. Load results if resultsFileId provided
  let finalOutputValues: OutputValues | undefined;
  if (options.resultsFileId && services.googleDriveClient) {
    const resultsResult = await Helpers.loadResults(
      options.resultsFileId,
      services.googleDriveClient
    );
    if (resultsResult.success) {
      finalOutputValues = resultsResult.finalOutputValues;
    }
  }

  // 8. Initialize the editor
  Helpers.initializeEditor(services.graphStore, controller.editor.graph, {
    graph: prepared.graph,
    moduleId: prepared.moduleId,
    subGraphId: prepared.subGraphId,
    url: resolvedUrl,
    readOnly: !isMineCheck(resolvedUrl),
    version,
    lastLoadedVersion,
    creator: options.creator,
    history,
    onHistoryChanged: (h) =>
      controller.board.main.saveEditHistory(resolvedUrl, h),
    finalOutputValues,
  });

  // 9. Update board controller state
  if (versionInfo?.isNewer) {
    controller.board.main.newerVersionAvailable = true;
  }

  // 10. Update global load state
  controller.global.main.loadState = "Loaded";

  logger.log(
    Utils.Logging.Formatter.info(`Loaded board: ${resolvedUrl}`),
    LABEL
  );

  return { success: true };
}

/* c8 ignore stop */

/**
 * Closes the current board and returns to the home state.
 */
export function close(): void {
  const { controller } = bind;

  // Reset the graph controller state
  controller.editor.graph.resetAll();

  // Return to home state
  controller.global.main.loadState = "Home";
}
