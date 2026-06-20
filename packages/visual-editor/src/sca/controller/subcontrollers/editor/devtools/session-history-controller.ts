/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Reactive state for the session history panel in devtools.
 *
 * Mirrors the backend's session monitor stream: each `sessionStatus`
 * event either upserts or removes an entry in the sessions map.
 * UI components read the signals; the monitor action writes them.
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export { SessionHistoryController };
export type { SessionEntry };

/** Frontend representation of a single session. */
interface SessionEntry {
  sessionId: string;
  status: string;
  createdAt: number;
}

class SessionHistoryController extends RootController {
  /**
   * Reactive session map — keyed by sessionId.
   * Updated by the session monitor action.
   * `deep: true` tracks mutations so `.set()` / `.delete()` trigger updates.
   */
  @field({ deep: true })
  accessor sessions: Map<string, SessionEntry> = new Map();

  /**
   * The session currently connected to the graph UI.
   * When null, no session is connected.
   */
  @field()
  accessor activeSessionId: string | null = null;

  /**
   * Abort controller for the active monitor SSE stream.
   * Actions use this to cancel the monitor when the graph changes.
   */
  monitorAbortController: AbortController | null = null;

  /**
   * Abort controller for the active session connection (replay/live stream).
   * Used when switching sessions or stopping the current connection.
   */
  connectionAbortController: AbortController | null = null;

  /** Process a sessionStatus event from the monitor stream. */
  applySessionStatus(event: SessionEntry): void {
    if (event.status === "deleted") {
      this.sessions.delete(event.sessionId);

      // If the deleted session was active, disconnect.
      if (this.activeSessionId === event.sessionId) {
        this.activeSessionId = null;
      }
    } else {
      this.sessions.set(event.sessionId, event);
    }
  }

  /** Clear all sessions and disconnect. */
  reset(): void {
    this.sessions = new Map();
    this.activeSessionId = null;
    this.monitorAbortController?.abort();
    this.monitorAbortController = null;
    this.connectionAbortController?.abort();
    this.connectionAbortController = null;
  }
}
