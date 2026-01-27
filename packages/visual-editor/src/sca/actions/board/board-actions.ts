/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
 * This action is typically called by the save trigger when the graph version
 * changes. It delegates to the board server for persistence.
 *
 * @throws Error if called without an editor (programming error)
 * @returns Promise resolving to save result, or undefined if save is not applicable
 */
export async function save(): Promise<{ result: boolean } | undefined> {
  const { controller, services } = bind;
  const { editor, url, readOnly } = controller.editor.graph;
  const logger = Utils.Logging.getLogger(controller);

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

  try {
    // The board server handles debouncing/queueing internally
    const result = await boardServer.save(boardUrl, graph, false);
    return result;
  } catch (error) {
    logger.log(
      Utils.Logging.Formatter.warning(
        `Failed to save board: ${error instanceof Error ? error.message : String(error)}`
      ),
      LABEL
    );
    return { result: false };
  }
}
