/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Input, InputWithDefault } from "./input.js";

export function output<T extends JsonSerializable>(
  port: Output<T> | OutputPortReference<T> | Input<T> | InputWithDefault<T>,
  {
    id,
    title,
    description,
  }: { id?: string; title?: string; description?: string } = {}
): Output<T> {
  return {
    __SpecialOutputBrand: true,
    id,
    title,
    description,
    port,
  };
}

export interface Output<T extends JsonSerializable | undefined> {
  readonly __SpecialOutputBrand: true;
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly port:
    | Output<T>
    | OutputPortReference<T>
    | Input<T>
    | InputWithDefault<T>;
}

export function isSpecialOutput(
  value: unknown
): value is Output<JsonSerializable> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__SpecialOutputBrand" in value
  );
}
