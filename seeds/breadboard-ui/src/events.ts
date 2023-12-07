/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class StartEvent extends Event {
  static eventName = "breadboardstartevent";

  constructor(public url: string) {
    super(StartEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export const enum ToastType {
  INFORMATION = "information",
  WARNING = "warning",
  ERROR = "error",
}

export class ToastEvent extends Event {
  static eventName = "breadboardtoastevent";

  constructor(public message: string, public toastType: ToastType) {
    super(ToastEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class DelayEvent extends Event {
  static eventName = "breadboarddelayevent";

  constructor(public duration: number) {
    super(DelayEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}
