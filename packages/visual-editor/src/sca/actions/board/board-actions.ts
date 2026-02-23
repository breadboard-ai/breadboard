/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditHistoryCreator,
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@breadboard-ai/types";
import { ConsentType, ConsentUIType } from "@breadboard-ai/types";
import { SnackType, type SnackbarUUID } from "../../types.js";
import type { StateEvent } from "../../../ui/events/events.js";
import { parseUrl } from "../../../ui/navigation/urls.js";
import { Utils } from "../../utils.js";
import { makeAction, withUIBlocking, stopRun } from "../binder.js";
import { asAction, ActionMode, stateEventTrigger } from "../../coordination.js";
import * as Helpers from "./helpers/helpers.js";
import { provideInput } from "../run/helpers/input-queue.js";
import {
  onVersionChange,
  onNewerVersionAvailable,
  onSaveStatusChange,
  onBoardRun,
  onBoardStop,
  onBoardRestart,
  onBoardInput,
  onBoardCreate,
  onBoardRemix,
  onBoardDelete,
  onSaveShortcut,
} from "./triggers.js";
import { forSection } from "../../../ui/strings/helper.js";

const Strings = forSection("Global");

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
 * Uses `awaits` mode to wait for pending trigger work before save.
 *
 * **Triggers:**
 * - `onVersionChange`: Fires when graph version changes and save conditions are met
 *
 * @param messages Optional messages for user acknowledgment snackbars
 * @throws Error if called without an editor (programming error)
 * @returns Promise resolving to save result, or undefined if save is not applicable
 */
export const save = asAction(
  "Board.save",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => onVersionChange(bind),
  },
  async (
    messages?: { start: string; end: string } | null
  ): Promise<{ result: boolean } | undefined> => {
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
);

/**
 * Saves the current graph as a new board.
 *
 * Uses `awaits` mode so it can be called from other Exclusive actions like remix.
 * Concurrency is managed by the caller (remix uses Exclusive).
 *
 * @param graph The graph descriptor to save
 * @param messages Snackbar messages for user feedback
 * @returns Promise resolving to result with new URL, or null if operation can't proceed
 */
export const saveAs = asAction(
  "Board.saveAs",
  ActionMode.Awaits,
  async (
    graph: GraphDescriptor,
    messages: { start: string; end: string; error: string }
  ): Promise<{ result: boolean; url?: URL } | null> => {
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

    const fail = { result: false, error: "Unable to save", url: undefined };

    const boardServer = services.googleDriveBoardServer;
    if (!boardServer) {
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
    }
  }
);

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
 * Uses `exclusive` mode to prevent concurrent remix operations.
 *
 * @param url The URL of the graph to remix
 * @param messages Snackbar messages for user feedback
 * @returns The save result with new URL, or an error result
 */
/**
 * Core remix logic, not wrapped in coordination.
 *
 * This is an implementation detail — callers that need coordination should use
 * `remix` (the coordinated wrapper). Parent actions that are already
 * coordinated (e.g. `onRemix`) call this directly to avoid nested-exclusive
 * deadlocks.
 */
async function remixImpl(
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

    const loadResult = await services.loader.load(url);

    if (
      !loadResult.success ||
      !loadResult.graph ||
      loadResult.graph.nodes.length === 0
    ) {
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

    graph = structuredClone(loadResult.graph);
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

export const remix = asAction("Board.remix", ActionMode.Exclusive, remixImpl);

/**
 * Deletes a board from the board server.
 *
 * Uses `exclusive` mode as this is a destructive operation.
 *
 * @param url The URL of the board to delete
 * @param messages Snackbar messages for user feedback
 * @returns Promise resolving to the delete result
 */
/**
 * Core delete-board logic, not wrapped in coordination.
 *
 * Parent actions that are already coordinated (e.g. `onDelete`) call this
 * directly to avoid nested-exclusive deadlocks.
 */
async function deleteBoardImpl(
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

export const deleteBoard = asAction(
  "Board.deleteBoard",
  ActionMode.Exclusive,
  deleteBoardImpl
);

/**
 * Options for the load action.
 */
export interface LoadOptions {
  /** Base URL to resolve relative URLs against */
  baseUrl?: string | null;
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
 * Uses `exclusive` mode to prevent concurrent loads from racing.
 *
 * @param url The URL of the board to load
 * @param options Optional load configuration
 * @returns Load result indicating success or failure reason
 */
export const load = asAction(
  "Board.load",
  ActionMode.Exclusive,
  async (url: string, options: LoadOptions = {}): Promise<LoadResult> => {
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
    Helpers.initializeEditor(controller.editor.graph, {
      graph: prepared.graph,
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
      graphStoreArgs: {
        loader: services.loader,
        sandbox: services.sandbox,
        flags: controller.global.flags,
      },
    });

    // 9. Update theme hash for the newly loaded graph
    controller.editor.theme.updateHash(prepared.graph);

    // 10. Reset run state for new graph (clear console entries from previous graph)
    controller.run.main.reset();
    controller.run.main.clearRunner();
    controller.run.screen.reset();
    controller.run.renderer.reset();
    controller.editor.share.reset();

    // 10. Update board controller state
    if (versionInfo?.isNewer) {
      controller.board.main.newerVersionAvailable = true;
    }

    // 11. Update global load state
    controller.global.main.loadState = "Loaded";

    logger.log(
      Utils.Logging.Formatter.info(`Loaded board: ${resolvedUrl}`),
      LABEL
    );

    return { success: true };
  }
);
/* c8 ignore end */

/**
 * Closes the current board and returns to the home state.
 */
export const close = asAction(
  "Board.close",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;

    // Reset run state
    controller.run.main.reset();
    controller.run.main.clearRunner();
    controller.run.screen.reset();
    controller.run.renderer.reset();

    // Reset the graph controller state
    controller.editor.graph.resetAll();

    // Return to home state
    controller.global.main.loadState = "Home";
  }
);

// =============================================================================
// Triggered Actions
// =============================================================================

/**
 * Shows a snackbar when a newer version of a shared graph is available.
 *
 * **Triggers:**
 * - `onNewerVersionAvailable`: Fires when newerVersionAvailable becomes true
 */
export const showNewerVersionSnackbar = asAction(
  "Board.showNewerVersionSnackbar",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNewerVersionAvailable(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;

    // Show the snackbar
    controller.global.snackbars.snackbar(
      "A newer version of this board is available",
      SnackType.INFORMATION,
      [],
      true, // persistent
      globalThis.crypto.randomUUID() as SnackbarUUID,
      true // replaceAll
    );

    // Reset the flag so it doesn't trigger again
    controller.board.main.newerVersionAvailable = false;
  }
);

/**
 * Updates the save status when the board server reports changes.
 *
 * **Triggers:**
 * - `onSaveStatusChange`: Fires on savestatuschange events from board server
 */
export const handleSaveStatus = asAction(
  "Board.handleSaveStatus",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSaveStatusChange(bind),
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;

    // Type assertion for the custom event
    const event = evt as unknown as { url: string; status: string } | undefined;
    if (!event) return;

    const { url, status } = event;
    const currentUrl = controller.editor.graph.url;

    // Only update if this is the current graph
    if (!currentUrl || currentUrl !== url) {
      return;
    }

    // Map BoardServerSaveEventStatus to our simplified status
    switch (status) {
      case "saving":
        controller.editor.graph.saveStatus = "saving";
        break;
      case "idle":
        controller.editor.graph.saveStatus = "saved";
        break;
      case "debouncing":
      case "queued":
        controller.editor.graph.saveStatus = "unsaved";
        break;
      default:
        controller.editor.graph.saveStatus = "saved";
        break;
    }
  }
);

// =============================================================================
// Event-Triggered Actions
// =============================================================================

/**
 * Loads a board by navigating to its URL.
 *
 * **Triggers:** `board.load` StateEvent
 */
export const onLoad = asAction(
  "Board.onLoad",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Load",
        services.stateEventBus,
        "board.load"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"board.load">).detail;

    if (Utils.Helpers.isHydrating(() => controller.global.main.mode)) {
      await controller.global.main.isHydrated;
    }

    controller.router.go({
      page: "graph",
      mode: controller.global.main.mode,
      flow: detail.url,
      resourceKey: undefined,
      dev: parseUrl(window.location.href).dev,
      guestPrefixed: true,
    });
    controller.home.recent.add({ url: detail.url });
  }
);

/**
 * Renames the current board.
 *
 * **Triggers:** `board.rename` StateEvent
 */
export const onRename = asAction(
  "Board.onRename",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Rename",
        services.stateEventBus,
        "board.rename"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"board.rename">).detail;
    const { editor } = controller.editor.graph;
    if (!editor) return;

    await withUIBlocking(controller, async () => {
      await editor.edit(
        [
          {
            type: "changegraphmetadata",
            title: detail.title ?? undefined,
            description: detail.description ?? undefined,
            graphId: "",
          },
        ],
        "Updating title and description"
      );
    });
  }
);

/**
 * Toggles pin status of a board in recents.
 *
 * **Triggers:** `board.togglepin` StateEvent
 */
export const onTogglePin = asAction(
  "Board.onTogglePin",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Toggle Pin",
        services.stateEventBus,
        "board.togglepin"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"board.togglepin">).detail;
    controller.home.recent.setPin(detail.url, detail.status === "pin");
  }
);

/**
 * Undoes the last graph edit.
 *
 * **Triggers:** `board.undo` StateEvent
 */
export const onUndo = asAction(
  "Board.onUndo",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Undo",
        services.stateEventBus,
        "board.undo"
      );
    },
  },
  async (): Promise<void> => {
    const { controller } = bind;
    if (controller.editor.graph.readOnly) return;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canUndo()) return;
    await history.undo();
  }
);

/**
 * Redoes the last undone graph edit.
 *
 * **Triggers:** `board.redo` StateEvent
 */
export const onRedo = asAction(
  "Board.onRedo",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Redo",
        services.stateEventBus,
        "board.redo"
      );
    },
  },
  async (): Promise<void> => {
    const { controller } = bind;
    if (controller.editor.graph.readOnly) return;
    const history = controller.editor.graph.editor?.history();
    if (!history || !history.canRedo()) return;
    await history.redo();
  }
);

/**
 * Replaces the current board with a new one (including theme).
 *
 * Sets `pendingGraphReplacement` on the graph controller so the existing
 * `Graph.replaceWithTheme` trigger picks it up and handles the actual
 * replacement + theme application.
 *
 * **Triggers:** `board.replace` StateEvent
 */
export const onReplace = asAction(
  "Board.onReplace",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Board Replace",
        services.stateEventBus,
        "board.replace"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"board.replace">).detail;

    controller.editor.graph.pendingGraphReplacement = {
      replacement: detail.replacement,
      theme: detail.theme,
      creator: detail.creator,
    };
  }
);

// =============================================================================
// Keyboard-triggered Actions
// =============================================================================

/**
 * Keyboard shortcut for saving a board.
 *
 * **Triggers:** `Cmd+s` / `Ctrl+s`
 */
export const onSave = asAction(
  "Board.onSave",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => onSaveShortcut(bind),
  },
  async (): Promise<void> => {
    await save({
      start: Strings.from("STATUS_SAVING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_SAVED"),
    });
  }
);

// =============================================================================
// State-Event-Triggered Board Routes
// =============================================================================
// Migrated from event-routing/board/board.ts.

/**
 * Core run-board logic, not wrapped in coordination.
 *
 * Checks sign-in, consent, and starts the runner. Parent actions that are
 * already coordinated (e.g. `onRestart`) call this directly to avoid
 * nested-exclusive deadlocks.
 */
async function runBoard(): Promise<void> {
  const { controller, services } = bind;
  const gc = controller.editor.graph;
  const logger = Utils.Logging.getLogger(controller);

  if (!gc.graph) {
    logger.log(Utils.Logging.Formatter.warning("No board loaded"), LABEL);
    return;
  }

  if ((await services.askUserToSignInIfNeeded()) !== "success") {
    return;
  }

  /* c8 ignore start */
  if (!controller.run.main.runner) {
    logger.log(Utils.Logging.Formatter.warning("Runner not available"), LABEL);
    return;
  }
  /* c8 ignore end */

  // b/452677430 - Check for consent before running shared Opals that
  // use the get_webpage tool, as this could be a data exfiltration vector.
  if ((await controller.global.flags.flags()).requireConsentForGetWebpage) {
    const url = gc.url;
    const boardServer = services.googleDriveBoardServer;
    const isGalleryApp = url && boardServer.galleryGraphs.has(url);
    const usesGetWebpage = gc.editor
      ?.inspect("")
      ?.usesTool("embed://a2/tools.bgl.json#module:get-webpage");
    const needsConsent = !isGalleryApp && gc.readOnly && usesGetWebpage;

    if (needsConsent) {
      const hasConsent =
        url &&
        (await controller.global.consent.queryConsent(
          {
            type: ConsentType.GET_ANY_WEBPAGE,
            scope: {},
            graphUrl: url,
          },
          ConsentUIType.IN_APP
        ));

      if (!hasConsent) {
        return;
      }
    }
  }

  controller.run.main.runner.start();
}

export const onRun = asAction(
  "Board.onRun",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onBoardRun(bind),
  },
  runBoard
);

/**
 * Stops the current run.
 *
 * If `finalOutputValues` are populated (result-only view from a shared link),
 * clears them and strips the `?results=` param from the URL via the router
 * instead of directly manipulating `history`.
 *
 * **Triggers:** `board.stop` StateEvent
 */
export const onStop = asAction(
  "Board.onStop",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onBoardStop(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const gc = controller.editor.graph;

    if (!gc.graph) {
      return;
    }

    if (gc.finalOutputValues) {
      gc.finalOutputValues = undefined;

      // Strip ?results= from the URL using the router (instead of direct
      // history.pushState) so that the router's reactive parsedUrl stays in
      // sync.
      const current = controller.router.parsedUrl;
      if (current.page === "graph" && "results" in current && current.results) {
        controller.router.go({ ...current, results: undefined });
      }
    }

    // Stop the run.
    stopRun(controller);
  }
);

/**
 * Restarts the run: stops the current run, logs the analytics event, then
 * starts a fresh run.
 *
 * **Triggers:** `board.restart` StateEvent
 */
export const onRestart = asAction(
  "Board.onRestart",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onBoardRestart(bind),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;

    await onStop();

    services.actionTracker.runApp(
      controller.editor.graph.url ?? undefined,
      "console"
    );

    // Call the plain function directly — not the coordinated `onRun` wrapper —
    // to avoid a nested-exclusive deadlock.
    await runBoard();
  }
);

/**
 * Provides user input to the running graph.
 *
 * **Triggers:** `board.input` StateEvent
 */
export const onInput = asAction(
  "Board.onInput",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onBoardInput(bind),
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    if (!controller.editor.graph.graph) {
      return;
    }

    const detail = (evt as StateEvent<"board.input">).detail;
    provideInput(detail.data as InputValues, controller.run);
  }
);

/**
 * Creates a new board from a graph descriptor.
 *
 * Gated behind sign-in. On success, navigates to the new board and notifies
 * the embedder.
 *
 * **Triggers:** `board.create` StateEvent
 */
export const onCreate = asAction(
  "Board.onCreate",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onBoardCreate(bind),
  },
  async (evt?: Event): Promise<void> => {
    const { controller, services } = bind;
    const detail = (evt as StateEvent<"board.create">).detail;

    if ((await services.askUserToSignInIfNeeded()) !== "success") {
      controller.global.snackbars.unsnackbar();
      return;
    }

    await withUIBlocking(controller, async () => {
      const result = await saveAs(detail.graph, detail.messages);

      if (!result?.url) {
        return;
      }

      Helpers.navigateToNewBoard(controller, services, result.url);
    });
  }
);

/**
 * Remixes a board: copies it with " Remix" appended to the title, saves as
 * a new board, then navigates to it.
 *
 * **Triggers:** `board.remix` StateEvent
 */
export const onRemix = asAction(
  "Board.onRemix",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onBoardRemix(bind),
  },
  async (evt?: Event): Promise<void> => {
    const { controller, services } = bind;
    const detail = (evt as StateEvent<"board.remix">).detail;

    await withUIBlocking(controller, async () => {
      // Call the plain function directly — not the coordinated `remix`
      // wrapper — to avoid a nested-exclusive deadlock.
      const result = await remixImpl(detail.url, detail.messages);

      if (!result?.success) {
        return;
      }

      Helpers.navigateToNewBoard(controller, services, result.url);
    });
  }
);

/**
 * Deletes a board after user confirmation.
 *
 * Removes the board from recents, deselects everything, and navigates home
 * (unless already on the home page).
 *
 * **Triggers:** `board.delete` StateEvent
 */
export const onDelete = asAction(
  "Board.onDelete",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onBoardDelete(bind),
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"board.delete">).detail;

    if (!confirm(detail.messages.query)) {
      return;
    }

    await withUIBlocking(controller, async () => {
      // Call the plain function directly — not the coordinated `deleteBoard`
      // wrapper — to avoid a nested-exclusive deadlock.
      await deleteBoardImpl(detail.url, detail.messages);
      controller.home.recent.remove(detail.url);
      await controller.home.recent.isSettled;
    });

    controller.editor.selection.deselectAll();

    if (controller.router.parsedUrl.page === "home") return;

    const { lite, dev } = parseUrl(window.location.href);
    controller.router.go({
      page: "home",
      lite,
      dev,
      guestPrefixed: true,
    });
  }
);
