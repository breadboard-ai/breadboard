/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import { SignalSet } from "signal-utils/set";
import { SignalArray } from "signal-utils/array";
import { SignalObject } from "signal-utils/object";
import { isLitTemplateResult } from "./is-lit-template.js";

export function wrap(value: unknown): unknown {
  if (
    value instanceof SignalMap ||
    value instanceof SignalSet ||
    value instanceof SignalArray ||
    value instanceof SignalObject
  ) {
    return value;
  }

  if (value instanceof Map) {
    return new DeepSignalMap(
      Array.from(value.entries()).map(([k, v]) => [k, wrap(v)])
    );
  }

  if (value instanceof Set) {
    return new DeepSignalSet(Array.from(value).map((v) => wrap(v)));
  }

  if (Array.isArray(value)) {
    return createDeepSignalArray(value.map((v) => wrap(v)));
  }

  if (value && typeof value === "object" && value !== null) {
    if (
      Object.getPrototypeOf(value) === Object.prototype &&
      !isLitTemplateResult(value)
    ) {
      const out: Record<string, unknown> = {};
      for (const key in value) {
        out[key] = wrap((value as Record<string, unknown>)[key]);
      }
      return createDeepSignalObject(out);
    }
  }

  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep-wrapping safeguards
//
// signal-utils collections (SignalMap, SignalSet, SignalArray, SignalObject)
// store values as-is on mutation.  For `@field({ deep: true })`, we need
// every nested value to be wrapped so that property mutations are tracked.
//
// - Map / Set: subclass with overridden mutator methods.
// - Array / Object: their SignalArray / SignalObject return Proxies from
//   their constructors, so subclassing doesn't work. Instead, we create
//   the signal collection normally and then replace the Proxy handler's
//   `set` trap with one that calls `wrap()` on the value.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A SignalMap that automatically deep-wraps values on `set()`.
 */
class DeepSignalMap<K = unknown, V = unknown> extends SignalMap<K, V> {
  override set(key: K, value: V): this {
    return super.set(key, wrap(value) as V);
  }
}

/**
 * A SignalSet that automatically deep-wraps values on `add()`.
 */
class DeepSignalSet<T = unknown> extends SignalSet<T> {
  override add(value: T): this {
    return super.add(wrap(value) as T);
  }
}

/**
 * Creates a SignalArray that auto-wraps values on index/property assignment.
 *
 * `SignalArray` returns a Proxy from its constructor, so subclassing doesn't
 * work. Instead, we create a normal `SignalArray` and then wrap it in a Proxy
 * that intercepts `set` to call `wrap()`.  The `getPrototypeOf` trap returns
 * `SignalArray.prototype` so `instanceof SignalArray` still works.
 */
function createDeepSignalArray<T>(items: T[]): SignalArray<T> {
  const arr = new SignalArray(items);
  return new Proxy(arr, {
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, wrap(value), receiver);
    },
    getPrototypeOf() {
      return SignalArray.prototype;
    },
  });
}

/**
 * Creates a SignalObject that auto-wraps values on property assignment.
 *
 * `SignalObject` returns a Proxy from its constructor, so subclassing doesn't
 * work. Instead, we create a normal `SignalObject` and then wrap it in a Proxy
 * that intercepts `set` to call `wrap()`.  The `getPrototypeOf` trap returns
 * `SignalObject.prototype` so `instanceof SignalObject` still works.
 */
function createDeepSignalObject<
  T extends Record<string, unknown> = Record<string, unknown>,
>(obj: T): T {
  const signalObj = new SignalObject(obj);
  return new Proxy(signalObj as object, {
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, wrap(value), receiver);
    },
    getPrototypeOf() {
      return SignalObject.prototype;
    },
  }) as T;
}

export function unwrap(value: unknown): unknown {
  if (value instanceof SignalMap) {
    return new Map(
      Array.from(value.entries()).map(([k, v]) => [unwrap(k), unwrap(v)])
    );
  }

  if (value instanceof SignalSet) {
    return new Set(Array.from(value).map((v) => unwrap(v)));
  }

  if (value instanceof SignalArray) {
    return value.map((v) => unwrap(v));
  }

  if (value instanceof SignalObject) {
    const out: Record<string, unknown> = {};
    for (const key in value) {
      out[key] = unwrap((value as Record<string, unknown>)[key]);
    }
    return out;
  }

  // Handle nested plain objects that might have been wrapped recursively
  if (value && typeof value === "object" && value !== null) {
    // If it's a plain object (not a Signal wrapper), check properties
    // just in case we have mixed structures, though usually wrap handles this.
    if (Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const key in value) {
        out[key] = unwrap((value as Record<string, unknown>)[key]);
      }
      return out;
    }
  }

  return value;
}
