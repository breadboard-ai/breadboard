/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/unified-signatures */
/* eslint-disable @typescript-eslint/ban-types */

export type Result<T, E = unknown> =
  | { ok: true; value: T; error?: undefined }
  | { ok: false; value?: undefined; error: E };

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
      .catch((error: E) => ({ ok: false as const, error }));
  } else if (typeof object === "function") {
    let syncValue;
    try {
      syncValue = object();
    } catch (error) {
      return { ok: false, error: error as E };
    }
    if (syncValue instanceof Promise) {
      return resultify<T, E>(syncValue);
    } else {
      return { ok: true, value: syncValue };
    }
  } else if ("onsuccess" in object && "onerror" in object) {
    return new Promise((resolve) => {
      object.onsuccess = () => resolve({ ok: true, value: object.result });
      object.onerror = () => resolve({ ok: false, error: object.error });
    });
  } else {
    console.error("Invalid argument to resultify", object);
    throw new Error("Invalid argument to resultify");
  }
}
