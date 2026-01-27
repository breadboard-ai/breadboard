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
    return new SignalMap(
      Array.from(value.entries()).map(([k, v]) => [k, wrap(v)])
    );
  }

  if (value instanceof Set) {
    return new SignalSet(Array.from(value).map((v) => wrap(v)));
  }

  if (Array.isArray(value)) {
    return new SignalArray(value.map((v) => wrap(v)));
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
      return new SignalObject(out);
    }
  }

  return value;
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
