/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Session management actions for the devtools sessions panel.
 *
 * - **startSessionMonitor**: opens the monitor SSE stream for the
 *   current graph and feeds sessionStatus events to the controller.
 * - **stopSessionMonitor**: cancels the active monitor stream.
 * - **deleteSession**: deletes a session on the backend.
 * - **connectToSession**: connects the graph UI to an existing session
 *   by replaying its events and then switching to live mode.
 */

import { makeAction } from "../binder.js";
import { Utils } from "../../utils.js";

export { startSessionMonitor, stopSessionMonitor, deleteSession };

export const bind = makeAction();

const LABEL = "Session Monitor";

// ---------------------------------------------------------------------------
// Monitor lifecycle
// ---------------------------------------------------------------------------

/**
 * Opens the session monitor SSE stream for the current graph.
 *
 * Feeds sessionStatus events to the SessionHistoryController, which
 * the sessions panel reads reactively. Cancels any existing monitor.
 */
async function startSessionMonitor(): Promise<void> {
  const { controller, services } = bind;
  const sessionHistory = controller.editor.devtools.sessionHistory;
  const graphRunService = services.graphRunService;

  // Cancel any existing monitor.
  stopSessionMonitor();

  const graphUrl = controller.editor.graph.url;
  const graphId = graphUrl?.startsWith("drive:/")
    ? graphUrl.replace("drive:/", "")
    : "";

  if (!graphId) {
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        "No graphId — skipping session monitor"
      ),
      LABEL
    );
    return;
  }

  const abortController = new AbortController();
  sessionHistory.monitorAbortController = abortController;

  Utils.Logging.getLogger(controller).log(
    Utils.Logging.Formatter.verbose(
      `Starting session monitor for graph ${graphId}`
    ),
    LABEL
  );

  try {
    for await (const event of graphRunService.monitorSessions(
      graphId,
      abortController.signal
    )) {
      if (abortController.signal.aborted) break;
      sessionHistory.applySessionStatus(event);
    }
  } catch (error) {
    if (!abortController.signal.aborted) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Session monitor error: ${String(error)}`
        ),
        LABEL
      );
    }
  }
}

/** Cancels the active session monitor stream. */
function stopSessionMonitor(): void {
  const { controller } = bind;
  const sessionHistory = controller.editor.devtools.sessionHistory;
  sessionHistory.monitorAbortController?.abort();
  sessionHistory.monitorAbortController = null;
}

// ---------------------------------------------------------------------------
// Session deletion
// ---------------------------------------------------------------------------

/** Deletes a session on the backend. */
async function deleteSession(sessionId: string): Promise<void> {
  const { controller, services } = bind;
  const graphRunService = services.graphRunService;

  Utils.Logging.getLogger(controller).log(
    Utils.Logging.Formatter.verbose(`Deleting session ${sessionId}`),
    LABEL
  );

  try {
    await graphRunService.deleteSession(sessionId);
    // The monitor stream will receive a sessionStatus with
    // status: "deleted" and remove it from the controller.
  } catch (error) {
    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.warning(
        `Delete session failed: ${String(error)}`
      ),
      LABEL
    );
  }
}
