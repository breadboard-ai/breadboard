/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner, RunEventMap } from "@google-labs/breadboard/harness";
import { TabId, TabURL } from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class RuntimeBoardLoadErrorEvent extends Event {
  static eventName = "runtimeboardloaderror" as const;

  constructor() {
    super(RuntimeBoardLoadErrorEvent.eventName, { ...eventInit });
  }
}

export class RuntimeErrorEvent extends Event {
  static eventName = "runtimeerror" as const;

  constructor(public readonly message: string) {
    super(RuntimeErrorEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardEditEvent extends Event {
  static eventName = "runtimeboardedit" as const;

  constructor(public readonly visualOnly = false) {
    super(RuntimeBoardEditEvent.eventName, { ...eventInit });
  }
}

export class RuntimeTabChangeEvent extends Event {
  static eventName = "runtimetabchange" as const;

  constructor(
    public readonly topGraphObserver?: BreadboardUI.Utils.TopGraphObserver
  ) {
    super(RuntimeTabChangeEvent.eventName, { ...eventInit });
  }
}

export class RuntimeCloseTabEvent extends Event {
  static eventName = "runtimeclosetab" as const;

  constructor(public readonly url: TabURL) {
    super(RuntimeCloseTabEvent.eventName, { ...eventInit });
  }
}

export class RuntimeBoardRunEvent extends Event {
  static eventName = "runtimeboardrun" as const;

  constructor(
    public readonly tabId: TabId,
    public readonly runEvt: RunEventMap[keyof RunEventMap],
    public readonly harnessRunner: HarnessRunner,
    public readonly abortController: AbortController
  ) {
    super(RuntimeBoardRunEvent.eventName, { ...eventInit });
  }
}

type RuntimeEvents =
  | RuntimeBoardLoadErrorEvent
  | RuntimeErrorEvent
  | RuntimeBoardEditEvent
  | RuntimeTabChangeEvent
  | RuntimeCloseTabEvent
  | RuntimeBoardRunEvent;

declare global {
  interface EventTarget {
    addEventListener<E extends RuntimeEvents>(
      type: string,
      listener: (evt: E) => void,
      options?: boolean | AddEventListenerOptions
    ): void;
  }
}
