/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const promisifyEventOnce = (target: EventTarget, type: string) =>
  new Promise((resolve) => {
    target.addEventListener(type, resolve, { once: true });
  });

type EventResolveFunction = (value: Event) => void;

export const promisifyEvent = (target: EventTarget, type: string) => {
  const eventQueue: Event[] = [];
  const resolveQueue: EventResolveFunction[] = [];
  target.addEventListener(type, (e) => {
    if (resolveQueue.length > 0) {
      resolveQueue.shift()?.(e);
    } else {
      eventQueue.push(e);
    }
  });
  return () => {
    if (eventQueue.length > 0) {
      return Promise.resolve(eventQueue.shift() as Event);
    }
    return new Promise<Event>((r) => {
      resolveQueue.push(r);
    });
  };
};
