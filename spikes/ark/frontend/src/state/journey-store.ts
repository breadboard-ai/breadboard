/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JourneyStore — signal-backed reactive state for multi-step journeys.
 *
 * Manages the journey lifecycle: starting journeys, fetching view bundles
 * for the current step, submitting user results, and tracking progress.
 * The ViewManager handles rendering; this store coordinates the data flow.
 */

import { Signal } from "signal-polyfill";
import {
  backend,
  type JourneySummary,
  type JourneyStatus,
} from "../services/backend.js";
import { parseMultipart } from "../pipeline/multipart.js";
import { mapPartsToBundle } from "../pipeline/bundle-mapper.js";
import type { ViewBundle } from "../types.js";

export { JourneyStore };

class JourneyStore {
  /** All known journeys. */
  readonly journeys = new Signal.State<JourneySummary[]>([]);

  /** The active journey (currently viewing). */
  readonly activeJourneyId = new Signal.State<string | null>(null);

  /** Status of the active journey. */
  readonly activeStatus = new Signal.State<JourneyStatus | null>(null);

  /** The current step's view bundle. */
  readonly currentBundle = new Signal.State<ViewBundle | null>(null);

  /** Loading state for bundle fetch. */
  readonly bundleLoading = new Signal.State(false);

  /** True when the active journey has finished all steps. */
  readonly completed = new Signal.State<boolean>(false);

  /** Whether the journey is processing (auto-advancing). */
  readonly processing = new Signal.State(false);

  /** Start a new journey. The backend returns immediately; generation
   *  runs in the background. We poll until the first view is ready. */
  async startJourney(objective: string) {
    const id = await backend.startJourney(objective);
    this.activeJourneyId.set(id);
    this.processing.set(true);

    // Poll until the journey is active and has a view.
    await this.#pollUntilReady(id);

    // Refresh the journey list.
    await this.#pollJourneys();
  }

  /** Submit the user's result from the current step and advance. */
  async submitResult(payload: Record<string, unknown>) {
    const journeyId = this.activeJourneyId.get();
    if (!journeyId) return;

    this.processing.set(true);
    this.currentBundle.set(null);

    try {
      const update = await backend.submitResult(journeyId, payload);

      if (update.complete) {
        // Journey is done — stay in the journey view, show completion.
        this.processing.set(false);
        this.completed.set(true);
        // Refresh status so context is up-to-date.
        const status = await backend.getJourneyStatus(journeyId);
        this.activeStatus.set(status);
        await this.#pollJourneys();
        return;
      }

      if (update.view_available) {
        // Next step has a view — fetch and render it.
        this.processing.set(false);
        await this.#fetchCurrentView(journeyId);
      } else {
        // Still processing (auto-advancing). Poll until a view is ready.
        await this.#pollUntilReady(journeyId);
      }

      await this.#pollJourneys();
    } catch (err) {
      console.error("[journey-store] submitResult failed:", err);
      this.processing.set(false);
    }
  }

  /** Close the current journey view and return to the list. */
  closeJourney() {
    this.currentBundle.set(null);
    this.activeJourneyId.set(null);
    this.activeStatus.set(null);
    this.processing.set(false);
    this.completed.set(false);
  }

  /** Delete a journey. */
  async deleteJourney(id: string) {
    await backend.deleteJourney(id);
    if (this.activeJourneyId.get() === id) {
      this.closeJourney();
    }
    await this.#pollJourneys();
  }

  /** Retry a failed journey — resets and re-triggers generation. */
  async retryJourney() {
    const journeyId = this.activeJourneyId.get();
    if (!journeyId) return;

    this.processing.set(true);
    this.activeStatus.set(null);
    await backend.retryJourney(journeyId);
    await this.#pollUntilReady(journeyId);
    await this.#pollJourneys();
  }

  /** Initial load of journeys. */
  async loadJourneys() {
    await this.#pollJourneys();
  }

  /** Resume viewing a journey (e.g. from the list). */
  async openJourney(id: string) {
    this.activeJourneyId.set(id);

    // Check status first — if still generating, poll until ready.
    const status = await backend.getJourneyStatus(id);
    this.activeStatus.set(status);

    if (
      status.status === "planning" ||
      status.status === "generating" ||
      !status.view_available
    ) {
      this.processing.set(true);
      await this.#pollUntilReady(id);
    } else {
      await this.#fetchCurrentView(id);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  async #fetchCurrentView(journeyId: string) {
    this.bundleLoading.set(true);
    this.currentBundle.set(null);

    try {
      // Get status first.
      const status = await backend.getJourneyStatus(journeyId);
      this.activeStatus.set(status);

      if (!status.view_available) {
        this.bundleLoading.set(false);
        return;
      }

      // Fetch the bundle.
      const response = await backend.fetchJourneyBundle(journeyId);
      const parts = await parseMultipart(response);
      const bundle = mapPartsToBundle(journeyId, parts);

      // Inject journey context as props on the first view.
      if (bundle.views.length > 0 && status.context) {
        bundle.views[0].props = { data: status.context };
      }

      bundle.source = "journey";
      this.currentBundle.set(bundle);
    } catch (err) {
      console.error("[journey-store] View fetch failed:", err);
      this.currentBundle.set(null);
    } finally {
      this.bundleLoading.set(false);
    }
  }

  async #pollUntilReady(journeyId: string, maxAttempts = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const status = await backend.getJourneyStatus(journeyId);
      this.activeStatus.set(status);

      if (status.status === "error") {
        console.error("[journey-store] Journey generation failed", journeyId);
        this.processing.set(false);
        return;
      }

      if (status.status === "complete") {
        this.processing.set(false);
        this.activeJourneyId.set(null);
        this.activeStatus.set(null);
        return;
      }

      if (status.view_available) {
        this.processing.set(false);
        await this.#fetchCurrentView(journeyId);
        return;
      }
    }

    // Gave up — something is stuck.
    console.warn("[journey-store] Polling timed out for journey", journeyId);
    this.processing.set(false);
  }

  async #pollJourneys() {
    try {
      const journeys = await backend.listJourneys();
      this.journeys.set(journeys);
    } catch {
      // Transient error — ignore.
    }
  }
}
