/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { brand, isBranded } from "../common/brand.js";
import type { Value } from "../common/value.js";
import type { JsonSerializable } from "../type-system/type.js";

export function output<T extends JsonSerializable | undefined>(
  port: Value<T>,
  {
    id,
    title,
    description,
  }: {
    id?: string;
    title?: string;
    description?: string;
  } = {}
): Output<T> {
  return {
    [brand]: "Output",
    id,
    title,
    description,
    port,
  };
}

export interface Output<
  T extends JsonSerializable | undefined = JsonSerializable | undefined,
> {
  readonly [brand]: "Output";
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly port: Value<T>;
}

export function isSpecialOutput(value: unknown): value is Output {
  return isBranded(value, "Output");
}
