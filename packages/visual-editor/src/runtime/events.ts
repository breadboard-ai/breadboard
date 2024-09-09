/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner, RunEventMap } from "@google-labs/breadboard/harness";
import { VETabId, VETabURL } from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class VEBoardLoadErrorEvent extends Event {
  static eventName = "veboardloaderror" as const;

  constructor() {
    super(VEBoardLoadErrorEvent.eventName, { ...eventInit });
  }
}

export class VEErrorEvent extends Event {
  static eventName = "veerror" as const;

  constructor(public readonly message: string) {
    super(VEErrorEvent.eventName, { ...eventInit });
  }
}

export class VEEditEvent extends Event {
  static eventName = "veedit" as const;

  constructor(public readonly visualOnly = false) {
    super(VEEditEvent.eventName, { ...eventInit });
  }
}

export class VETabChangeEvent extends Event {
  static eventName = "vetabchange" as const;

  constructor(
    public readonly topGraphObserver?: BreadboardUI.Utils.TopGraphObserver
  ) {
    super(VETabChangeEvent.eventName, { ...eventInit });
  }
}

export class VECloseTabEvent extends Event {
  static eventName = "veclosetab" as const;

  constructor(public readonly url: VETabURL) {
    super(VECloseTabEvent.eventName, { ...eventInit });
  }
}

export class VERunEvent extends Event {
  static eventName = "verun" as const;

  constructor(
    public readonly tabId: VETabId,
    public readonly runEvt: RunEventMap[keyof RunEventMap],
    public readonly harnessRunner: HarnessRunner,
    public readonly abortController: AbortController
  ) {
    super(VERunEvent.eventName, { ...eventInit });
  }
}

export class VEGraphChangeEvent extends Event {
  static eventName = "vegraphchange" as const;

  constructor(public readonly tabId: VETabId) {
    super(VEGraphChangeEvent.eventName, { ...eventInit });
  }
}

type VEEvents = VEErrorEvent | VETabChangeEvent | VECloseTabEvent;

declare global {
  interface EventTarget {
    addEventListener<E extends VEEvents>(
      type: string,
      listener: (evt: E) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
  }
}
