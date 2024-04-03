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

export function placeholder(): Placeholder<string>;

export function placeholder<T extends BreadboardType>(
  params: PlaceholderParams<T>
): Placeholder<ConvertBreadboardType<T>>;

/**
 * Create a new Breadboard placeholder.
 *
 * Placeholders can be used in place of real output ports for situations where
 * it is not yet possible to provide an actual output port, most notably because
 * of a cycle.
 *
 * IMPORTANT: The `resolve` method must be called on placeholders before the
 * `board` function is called.
 */
export function placeholder(
  params?: PlaceholderParams<BreadboardType>
): Placeholder<JsonSerializable> {
  return new Placeholder(params?.type ?? "string");
}

interface PlaceholderParams<T extends BreadboardType> {
  type: T;
}

const PLACEHOLDER_ENTITY_NAME = "Placeholder";

export type { Placeholder };
/**
 * Placeholders can be used in place of real output ports for situations where
 * it is not yet possible to provide an actual output port, most notably because
 * of a cycle.
 *
 * IMPORTANT: The `resolve` method must be called on placeholders before the
 * `board` function is called.
 */
class Placeholder<T extends JsonSerializable> {
  readonly __BreadboardEntity__ = PLACEHOLDER_ENTITY_NAME;
  readonly type: BreadboardType;
  #value?: OutputPortReference<T>;

  constructor(type: BreadboardType) {
    this.type = type;
  }

  /**
   * Set the value of this Placeholder. Throws if this Placeholder has already
   * been resolved.
   */
  resolve(value: OutputPortReference<T>): void {
    if (this.#value !== undefined) {
      throw new Error("Placeholder has already been resolved");
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
 * Test whether the given object is a Breadboard {@link Placeholder}.
 */
export function isPlaceholder(
  value: unknown
): value is Placeholder<JsonSerializable> {
  return isBreadboardEntity(value, PLACEHOLDER_ENTITY_NAME);
}

// TODO(aomarks) Use this pattern elsewhere.
function isBreadboardEntity(value: unknown, type: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __BreadboardEntity__?: unknown }).__BreadboardEntity__ === type
  );
}
