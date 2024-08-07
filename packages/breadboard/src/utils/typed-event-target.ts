/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A helper type that allows adding event listeners to an `EventTarget` with
 * event types from a given event map.
 *
 * This type is useful when you have an `EventTarget` that dispatches events
 * with a specific set of event types, and you want to add event listeners to
 * that target with type-checked event listeners.
 *
 */
export type TypedEventTarget<EventMap extends object> = {
  new (): TypedEventTargetType<EventMap>;
};

export interface TypedEventTargetType<EventMap> extends EventTarget {
  addEventListener<K extends keyof EventMap>(
    type: K,
    callback: (
      event: EventMap[K] extends Event ? EventMap[K] : never
    ) => EventMap[K] extends Event ? void : never,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void;
}
