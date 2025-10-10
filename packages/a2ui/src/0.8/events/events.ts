/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as A2UI from "./a2ui.js";
import { BaseEventDetail } from "./base.js";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

type EnforceEventTypeMatch<T extends Record<string, BaseEventDetail<string>>> =
  {
    [K in keyof T]: T[K] extends BaseEventDetail<infer EventType>
      ? EventType extends K
        ? T[K]
        : never
      : never;
  };

export type StateEventDetailMap = EnforceEventTypeMatch<{
  "a2ui.action": A2UI.A2UIAction;
}>;

export class StateEvent<
  T extends keyof StateEventDetailMap,
> extends CustomEvent<StateEventDetailMap[T]> {
  static eventName = "a2uiaction";

  constructor(readonly payload: StateEventDetailMap[T]) {
    super(StateEvent.eventName, { detail: payload, ...eventInit });
  }
}

declare global {
  interface HTMLElementEventMap {
    a2uiaction: StateEvent<"a2ui.action">;
  }
}
