/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VisualEditorStatusUpdate } from "../types.js";
import type { StatusUpdatesController } from "../controller/subcontrollers/global/status-updates-controller.js";
import * as Formatter from "../utils/logging/formatter.js";
import { getLogger } from "../utils/logging/logger.js";

const UPDATE_REFRESH_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const LABEL = "StatusUpdatesService";

/**
 * Service for fetching status updates from the server.
 *
 * Responsibilities:
 * - Periodically polls the `/updates` endpoint
 * - Passes fetched updates to the StatusUpdatesController
 *
 * This replaces the legacy Shell.startTrackUpdates() method.
 */
export class StatusUpdatesService {
  #timeoutId = 0;
  #controller: StatusUpdatesController | null = null;

  /**
   * Starts polling for status updates.
   * Immediately fetches updates, then polls every 10 minutes.
   *
   * @param controller The controller to receive status updates
   */
  async start(controller: StatusUpdatesController): Promise<void> {
    // Prevent duplicate polling
    if (this.#timeoutId !== 0) {
      return;
    }

    this.#controller = controller;
    await this.#poll();
  }

  /**
   * Stops polling for status updates.
   */
  stop(): void {
    if (this.#timeoutId !== 0) {
      window.clearTimeout(this.#timeoutId);
      this.#timeoutId = 0;
    }
    this.#controller = null;
  }

  async #poll(): Promise<void> {
    try {
      const updates = await this.#fetchUpdates();
      this.#controller?.setUpdates(updates);
    } catch (err) {
      const logger = getLogger();
      logger.log(Formatter.warning("Error fetching updates", err), LABEL);
    } finally {
      this.#timeoutId = window.setTimeout(
        () => this.#poll(),
        UPDATE_REFRESH_TIMEOUT
      );
    }
  }

  async #fetchUpdates(): Promise<VisualEditorStatusUpdate[]> {
    const response = await fetch("/updates");
    const updates = await response.json();
    if (updates === "error") {
      const logger = getLogger();
      logger.log(
        Formatter.info("Unable to fetch updates from the server"),
        LABEL
      );
      return [];
    }
    return updates as VisualEditorStatusUpdate[];
  }
}
