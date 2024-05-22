/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputPortReference } from "../common/port.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

export function loopback(): Loopback<string>;

export function loopback<T extends BreadboardType>(
  params: LoopbackParams<T>
): Loopback<ConvertBreadboardType<T>>;

/**
 * Create a new Breadboard loopback.
 *
 * Loopbacks can be used in place of real output ports for situations where it
 * is not yet possible to provide an actual output port because of a cycle in
 * the Breadboard program graph.
 *
 * IMPORTANT: The `resolve` method must be called on loopbacks before the
 * `board` function is called.
 */
export function loopback(
  params?: LoopbackParams<BreadboardType>
): Loopback<JsonSerializable> {
  return new Loopback(params?.type ?? "string");
}

interface LoopbackParams<T extends BreadboardType> {
  type: T;
}

const LOOPBACK_ENTITY_NAME = "Loopback";

export type { Loopback };
/**
 * Loopbacks can be used in place of real output ports for situations where it
 * is not yet possible to provide an actual output port, most notably because of
 * a cycle.
 *
 * IMPORTANT: The `resolve` method must be called on loopbacks before the
 * `board` function is called.
 */
class Loopback<T extends JsonSerializable> {
  readonly __BreadboardEntity__ = LOOPBACK_ENTITY_NAME;
  readonly type: BreadboardType;
  #value?: OutputPortReference<T>;

  constructor(type: BreadboardType) {
    this.type = type;
  }

  /**
   * Set the value of this Loopback. Throws if this Loopback has already
   * been resolved.
   */
  resolve(value: OutputPortReference<T>): void {
    if (this.#value !== undefined) {
      throw new Error("Loopback has already been resolved");
    }
    this.#value = value;
  }

  /**
   * Get the resolved value, or `undefined` if it has not yet been resolved.
   */
  get value(): OutputPortReference<T> | undefined {
    return this.#value;
  }
}

/**
 * Test whether the given object is a Breadboard {@link Loopback}.
 */
export function isLoopback(
  value: unknown
): value is Loopback<JsonSerializable> {
  return isBreadboardEntity(value, LOOPBACK_ENTITY_NAME);
}

// TODO(aomarks) Use this pattern elsewhere.
function isBreadboardEntity(value: unknown, type: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __BreadboardEntity__?: unknown }).__BreadboardEntity__ === type
  );
}
