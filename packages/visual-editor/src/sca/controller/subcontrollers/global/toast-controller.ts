/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ToastType } from "../../../../ui/events/events.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

type ToastMap = Map<
  string,
  {
    message: string;
    type: ToastType;
    persistent: boolean;
    state: "active" | "closing";
    timeoutId?: number;
  }
>;

const MAX_TOAST_LENGTH = 77;

export class ToastController extends RootController {
  @field()
  private accessor _toasts: ToastMap = new Map();

  constructor(
    id: string,
    private readonly defaultTimeout = 8000
  ) {
    super(id);
  }

  get toasts(): Readonly<ToastMap> {
    return this._toasts;
  }

  toast(
    message: string,
    type: ToastType,
    persistent = false,
    id = globalThis.crypto.randomUUID()
  ) {
    if (message.length > MAX_TOAST_LENGTH) {
      message = message.slice(0, MAX_TOAST_LENGTH - 3) + "...";
    }

    let timeoutId = -1;
    if (!persistent) {
      timeoutId = globalThis.window.setTimeout(() => {
        const toast = this._toasts.get(id);
        // Belt-and-braces check because untoasting should clear this timeout
        // and so it shouldn't be possible for the toast to not be here when the
        // timeout fires.
        /* c8 ignore next 3 */
        if (!toast) {
          return;
        }

        this._toasts.set(id, { ...toast, state: "closing" });
      }, this.defaultTimeout);
    }

    this._toasts.set(id, {
      message,
      type,
      persistent,
      state: "active",
      timeoutId,
    });
    return id;
  }

  untoast(id?: string) {
    if (!id) {
      for (const toast of this._toasts.values()) {
        globalThis.window.clearTimeout(toast.timeoutId);
      }
      this._toasts.clear();
      return;
    }

    const toast = this._toasts.get(id);
    if (toast) {
      globalThis.window.clearTimeout(toast.timeoutId);
    }

    this._toasts.delete(id);
  }
}
