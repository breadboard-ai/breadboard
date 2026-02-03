import { signal } from "signal-utils";
import { effect } from "signal-utils/subtle/microtask-effect";
import type { ConsoleEntry } from "@breadboard-ai/types";
import type { SCA } from "../../sca/sca.js";
import type { ConsoleStepState } from "../state/types.js";

export { ConsolePresenter };
export type { ConsoleStepState };

/**
 * ConsolePresenter - UI-layer presenter for the console view.
 *
 * This presenter provides the full detail needed for console-view:
 * - Console entries from RunController.console
 * - Work items (nested inputs/outputs)
 * - Final outputs
 * - Error state
 *
 * ## Lifecycle
 *
 * The host element (console-view) should:
 * 1. Call `connect(sca)` in connectedCallback
 * 2. Call `disconnect()` in disconnectedCallback
 *
 * This ensures the internal effect is properly disposed when the element
 * is removed from the DOM.
 *
 * ## Flash Prevention
 *
 * The presenter caches the last non-empty entries to prevent flashes when
 * the console is cleared between runs. The view always renders from the
 * cached entries.
 */
class ConsolePresenter {
  /**
   * Reactive map of console entries for rendering.
   * This is the cached version that prevents flashes.
   */
  @signal
  accessor entries: Map<string, ConsoleStepState> = new Map();

  /**
   * Estimated total entry count for progress calculation.
   */
  @signal
  accessor estimatedEntryCount: number = 0;

  #disposeEffect: (() => void) | null = null;
  #sca: SCA | null = null;

  /**
   * Connects the presenter to SCA and starts the effect.
   * Call this in the host element's connectedCallback.
   */
  connect(sca: SCA): void {
    if (this.#disposeEffect) {
      // Already connected
      return;
    }

    this.#sca = sca;

    this.#disposeEffect = effect(() => {
      this.#updateEntries();
    });
  }

  /**
   * Disconnects the presenter and stops the effect.
   * Call this in the host element's disconnectedCallback.
   */
  disconnect(): void {
    if (this.#disposeEffect) {
      this.#disposeEffect();
      this.#disposeEffect = null;
    }
    this.#sca = null;
    this.entries = new Map();
    this.estimatedEntryCount = 0;
  }

  /**
   * Updates the entries map by reading from controllers.
   * Also updates estimated entry count.
   */
  #updateEntries(): void {
    if (!this.#sca) return;

    const { controller } = this.#sca;
    const runController = controller.run.main;
    const runControllerConsole = runController.console;

    // Update estimated entry count
    this.estimatedEntryCount = runController.estimatedEntryCount;

    // Flash prevention: only update cache if console has entries
    if (runControllerConsole.size === 0) {
      // Keep existing entries to prevent flash
      return;
    }

    // Build the entries map
    const newEntries = new Map<string, ConsoleStepState>();

    for (const [id, entry] of runControllerConsole.entries()) {
      newEntries.set(id, this.#toConsoleStepState(entry));
    }

    this.entries = newEntries;
  }

  /**
   * Converts a ConsoleEntry to a ConsoleStepState.
   */
  #toConsoleStepState(entry: ConsoleEntry): ConsoleStepState {
    return {
      title: entry.title,
      icon: entry.icon,
      tags: entry.tags,
      status: entry.status ?? null,
      completed: entry.completed,
      open: entry.open,
      error: entry.error ?? null,
      work: entry.work,
      output: entry.output,
    };
  }
}
