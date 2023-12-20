/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const promisifyEventOnce = (target: EventTarget, type: string) =>
  new Promise((resolve) => {
    target.addEventListener(type, resolve, { once: true });
  });

type EventResolveFunction<T> = (value: T) => void;

export const promisifyEvent = <T extends Event = Event>(
  target: EventTarget,
  type: string
) => {
  const eventQueue: Event[] = [];
  const resolveQueue: EventResolveFunction<T>[] = [];
  target.addEventListener(type, (e) => {
    if (resolveQueue.length > 0) {
      resolveQueue.shift()?.(e as T);
    } else {
      eventQueue.push(e);
    }
  });
  return () => {
    if (eventQueue.length > 0) {
      return Promise.resolve(eventQueue.shift() as T);
    }
    return new Promise<T>((r) => {
      resolveQueue.push(r);
    });
  };
};
