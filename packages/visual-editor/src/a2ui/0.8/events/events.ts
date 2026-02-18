/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
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

/**
 * Maps event type strings to their corresponding detail types.
 *
 * The `EnforceEventTypeMatch` wrapper ensures that each entry's `eventType`
 * field matches its key — a compile-time guard against mismatched events.
 */
export type StateEventDetailMap = EnforceEventTypeMatch<{
  "a2ui.action": A2UI.A2UIAction;
  "a2ui.status": A2UI.A2UIStatus;
}>;

/**
 * Converts an event type key like `"a2ui.action"` into a DOM event name
 * like `"a2uiaction"` (strips dots).
 */
function toEventName(eventType: string): string {
  return eventType.replaceAll(".", "");
}

/**
 * Typed custom event for A2UI interactions.
 *
 * Dispatched by interactive components (e.g. Button, Image) and registered
 * globally on `HTMLElementEventMap`. The DOM event name is derived from
 * the event type (e.g. `"a2ui.action"` → `"a2uiaction"`).
 *
 * The event bubbles, is composed (crosses shadow boundaries), and is
 * cancelable.
 */
export class StateEvent<
  T extends keyof StateEventDetailMap,
> extends CustomEvent<StateEventDetailMap[T]> {
  constructor(readonly payload: StateEventDetailMap[T]) {
    super(toEventName(payload.eventType), { detail: payload, ...eventInit });
  }
}

declare global {
  interface HTMLElementEventMap {
    a2uiaction: StateEvent<"a2ui.action">;
    a2uistatus: StateEvent<"a2ui.status">;
  }
}
