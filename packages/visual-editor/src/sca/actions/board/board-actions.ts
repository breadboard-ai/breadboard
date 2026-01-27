/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { SnackType, type SnackbarUUID } from "../../../ui/types/types.js";
import { Utils } from "../../utils.js";
import { makeAction } from "../binder.js";

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
    const copiedGraph = await boardServer.deepCopy(ignoredPlaceholderUrl, graph);

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
