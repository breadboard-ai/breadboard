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

/**
 * Controller for managing snackbar notifications.
 *
 * Snackbars differ from toasts in that they:
 * - Have different types (PENDING, INFORMATION, WARNING, ERROR)
 * - Can have action buttons
 * - Support a "replaceAll" mode
 *
 * The bb-snackbar component observes the `snackbars` signal via SignalWatcher
 * and automatically re-renders when the state changes.
 */
export class SnackbarController extends RootController {
  @field({ deep: true })
  private accessor _snackbars: SnackbarMap = new Map();

  /**
   * Stores detail info for the snackbar details modal.
   * Set when a "details" action is triggered from a snackbar.
   */
  @field()
  accessor lastDetailsInfo: string | HTMLTemplateResult | null = null;

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  get snackbars(): Readonly<SnackbarMap> {
    return this._snackbars;
  }

  /**
   * Shows a snackbar notification.
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
      this._snackbars.clear();
    }

    const entry: SnackbarEntry = {
      id,
      message,
      type,
      actions,
      persistent,
    };

    this._snackbars.set(id, entry);

    return id;
  }

  /**
   * Removes a snackbar by ID, or all snackbars if no ID is provided.
   *
   * @param id Optional snackbar ID to remove
   */
  unsnackbar(id?: SnackbarUUID): void {
    if (!id) {
      this._snackbars.clear();
    } else {
      this._snackbars.delete(id);
    }
  }

  /**
   * Updates an existing snackbar's message, type, and optionally persistent flag.
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

    const updated: SnackbarEntry = {
      ...snackbar,
      message,
      type,
      ...(persistent !== undefined && { persistent }),
    };

    this._snackbars.set(id, updated);

    return true;
  }
}
