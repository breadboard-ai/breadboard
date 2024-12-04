/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-types */

import type { Result } from "./result.js";

export function resultify<T, E = unknown>(
  promise: Promise<T>
): Promise<Result<T, E>>;

export function resultify<T, E = unknown>(
  asyncFn: () => Promise<T>
): Promise<Result<T, E>>;

export function resultify<T, E = unknown>(syncFn: () => T): Result<T, E>;

/** IndexedDB-style APIs. */
export function resultify<T, E>(request: {
  result: T;
  error: E;
  onsuccess: Function | null | undefined;
  onerror: Function | null | undefined;
}): Promise<Result<T, E>>;

export function resultify<T = unknown, E = unknown>(
  object:
    | Promise<T>
    | (() => Promise<T>)
    | (() => T)
    | {
        result: T;
        error: E;
        onsuccess?: Function | null;
        onerror?: Function | null;
      }
): Result<T, E> | Promise<Result<T, E>> {
  if (object instanceof Promise) {
    return object
      .then((value) => ({ ok: true as const, value }))
      .catch((error: E) => ({ ok: false, error }));
  } else if (typeof object === "function") {
    let syncValue;
    try {
      syncValue = object();
    } catch (error) {
      return { ok: false, error: error as E };
    }
    if (syncValue instanceof Promise) {
      return resultify(syncValue);
    } else {
      return { ok: true, value: syncValue };
    }
  } else if ("onsuccess" in object && "onerror" in object) {
    return new Promise((resolve) => {
      object.onsuccess = () => resolve({ ok: true, value: object.result });
      object.onerror = () => resolve({ ok: false, error: object.error });
    });
  } else {
    const msg = `Internal error: Invalid resultify argument ${object}`;
    console.error(msg, object);
    return {
      ok: false,
      error: new Error(msg) as E,
    };
  }
}
