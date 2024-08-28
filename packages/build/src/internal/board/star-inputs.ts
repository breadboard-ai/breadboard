/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { brand, isBranded } from "../common/brand.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

/**
 * Initialization parameters for {@link starInputs}.
 */
export interface StarInputsInit<T extends BreadboardType> {
  type: T;
}

/**
 * Get a handle to the "star ports" from a board's input components.
 */
export function starInputs<T extends BreadboardType>({
  type,
}: StarInputsInit<T>): StarInputs<ConvertBreadboardType<T>> {
  return new StarInputs(type);
}

export type { StarInputs };

class StarInputs<
  T extends JsonSerializable | undefined = JsonSerializable | undefined,
> {
  readonly [brand] = "StarInputs";
  readonly type: BreadboardType;

  constructor(type: BreadboardType) {
    this.type = type;
  }
}

/**
 * Test whether the given object is a Breadboard {@link StarInputs}.
 */
export function isStarInputs(value: unknown): value is StarInputs {
  return isBranded(value, "StarInputs");
}
