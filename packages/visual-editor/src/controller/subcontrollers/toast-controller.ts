/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ToastType } from "../../ui/events/events.js";
import { field } from "../decorators/field.js";
import { RootController } from "./root-controller.js";

type ToastMap = Map<
  string,
  {
    message: string;
    type: ToastType;
    persistent: boolean;
  }
>;

const MAX_TOAST_LENGTH = 77;

export class ToastController extends RootController {
  @field({ persist: "session" })
  private accessor _toasts: ToastMap = new Map();

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

    this._toasts.set(id, { message, type, persistent });
    return id;
  }

  untoast(id?: string) {
    if (!id) {
      this._toasts.clear();
      return;
    }

    this._toasts.delete(id);
  }
}
