/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HTMLTemplateResult } from "lit";
import type {
  SnackbarAction,
  SnackType,
  SnackbarUUID,
} from "../../../types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Snackbar message data stored in the controller.
 */
export interface SnackbarEntry {
  id: SnackbarUUID;
  message: string | HTMLTemplateResult;
  type: SnackType;
  actions: SnackbarAction[];
  persistent: boolean;
}

type SnackbarMap = Map<SnackbarUUID, SnackbarEntry>;

const DEFAULT_TIMEOUT = 10_000;

/**
 * Controller for managing snackbar notifications.
 *
 * Snackbars differ from toasts in that they:
 * - Have different types (PENDING, INFORMATION, WARNING, ERROR)
 * - Can have action buttons
 * - Support a "replaceAll" mode
 *
 * The controller owns the full dismiss lifecycle: non-persistent snackbars
 * automatically transition to "closing" state after the configured timeout,
 * mirroring the pattern used by ToastController. The bb-snackbar component
 * observes the `snackbars` signal via SignalWatcher and re-renders accordingly.
 */
export class SnackbarController extends RootController {
  @field({ deep: true })
  private accessor _snackbars: SnackbarMap = new Map();

  /**
   * Per-entry timeout IDs, tracked separately from the SnackbarEntry to avoid
   * storing timer handles in the signal-backed map.
   */
  readonly #timeouts = new Map<SnackbarUUID, number>();

  /**
   * Stores detail info for the snackbar details modal.
   * Set when a "details" action is triggered from a snackbar.
   */
  @field()
  accessor lastDetailsInfo: string | HTMLTemplateResult | null = null;

  constructor(
    controllerId: string,
    persistenceId: string,
    private readonly defaultTimeout = DEFAULT_TIMEOUT
  ) {
    super(controllerId, persistenceId);
  }

  get snackbars(): Readonly<SnackbarMap> {
    return this._snackbars;
  }

  /**
   * Shows a snackbar notification.
   *
   * Non-persistent snackbars automatically transition to "closing" state after
   * the configured timeout.
   *
   * @param message The message to display (string or HTML template)
   * @param type The snackbar type (PENDING, INFORMATION, WARNING, ERROR)
   * @param actions Optional action buttons
   * @param persistent If true, snackbar won't auto-dismiss
   * @param id Optional UUID for the snackbar (generated if not provided)
   * @param replaceAll If true, removes all existing snackbars before showing
   * @returns The snackbar UUID
   */
  snackbar(
    message: string | HTMLTemplateResult,
    type: SnackType,
    actions: SnackbarAction[] = [],
    persistent = false,
    id: SnackbarUUID = globalThis.crypto.randomUUID(),
    replaceAll = false
  ): SnackbarUUID {
    if (replaceAll) {
      this.#clearAllTimeouts();
      this._snackbars.clear();
    }

    // If adding a persistent entry, cancel all existing timeouts — the bar
    // should stay open until the persistent entry is explicitly dismissed.
    if (persistent) {
      this.#clearAllTimeouts();
    }

    this._snackbars.set(id, { id, message, type, actions, persistent });

    // Only start a timeout if this entry is non-persistent AND no persistent
    // entry is already holding the bar open.
    if (!persistent && !this.#hasPersistent()) {
      this.#startTimeout(id);
    }

    return id;
  }

  /**
   * Removes a snackbar by ID, or all snackbars if no ID is provided.
   *
   * @param id Optional snackbar ID to remove
   */
  unsnackbar(id?: SnackbarUUID): void {
    if (!id) {
      this.#clearAllTimeouts();
      this._snackbars.clear();
      return;
    }

    const snackbar = this._snackbars.get(id);
    this.#clearTimeout(id);
    this._snackbars.delete(id);

    // If we just removed a persistent entry and no persistent entries remain,
    // restart timeouts for the remaining non-persistent entries.
    if (snackbar?.persistent && !this.#hasPersistent()) {
      this.#restartNonPersistentTimeouts();
    }
  }

  /**
   * Updates an existing snackbar's message, type, and optionally persistent
   * flag.
   *
   * When `persistent` changes, the timeout is started or cleared accordingly.
   *
   * @param id The snackbar ID to update
   * @param message The new message
   * @param type The new type
   * @param persistent If provided, updates the snackbar's persistent flag
   * @returns True if the snackbar was found and updated
   */
  update(
    id: SnackbarUUID,
    message: string | HTMLTemplateResult,
    type: SnackType,
    persistent?: boolean
  ): boolean {
    const snackbar = this._snackbars.get(id);
    if (!snackbar) {
      return false;
    }

    const newPersistent = persistent ?? snackbar.persistent;

    // Clear any existing timeout before potentially starting a new one.
    this.#clearTimeout(id);

    // Becoming persistent: cancel all existing timeouts.
    if (newPersistent && !snackbar.persistent) {
      this.#clearAllTimeouts();
    }

    this._snackbars.set(id, {
      ...snackbar,
      message,
      type,
      persistent: newPersistent,
    });

    // Only start a timeout if non-persistent and no persistent entry holds
    // the bar open (excluding this entry which is being updated).
    const otherPersistent = [...this._snackbars.values()].some(
      (s) => s.id !== id && s.persistent
    );
    if (!newPersistent && !otherPersistent) {
      this.#startTimeout(id);
    }

    // Becoming non-persistent and was the only persistent entry: restart
    // timeouts for all remaining non-persistent entries.
    if (!newPersistent && snackbar.persistent && !this.#hasPersistent()) {
      this.#restartNonPersistentTimeouts();
    }

    return true;
  }

  #startTimeout(id: SnackbarUUID): void {
    const timeoutId = globalThis.window.setTimeout(() => {
      this.#timeouts.delete(id);
      this._snackbars.delete(id);
    }, this.defaultTimeout);
    this.#timeouts.set(id, timeoutId);
  }

  #clearTimeout(id: SnackbarUUID): void {
    globalThis.window.clearTimeout(this.#timeouts.get(id));
    this.#timeouts.delete(id);
  }

  #hasPersistent(): boolean {
    for (const snackbar of this._snackbars.values()) {
      if (snackbar.persistent) return true;
    }
    return false;
  }

  #clearAllTimeouts(): void {
    for (const timeoutId of this.#timeouts.values()) {
      globalThis.window.clearTimeout(timeoutId);
    }
    this.#timeouts.clear();
  }

  #restartNonPersistentTimeouts(): void {
    for (const snackbar of this._snackbars.values()) {
      if (!snackbar.persistent && !this.#timeouts.has(snackbar.id)) {
        this.#startTimeout(snackbar.id);
      }
    }
  }
}
