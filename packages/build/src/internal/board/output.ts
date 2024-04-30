/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";

export function output<T extends JsonSerializable>(
  port: OutputPortReference<T>,
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

export interface Output<T extends JsonSerializable> {
  readonly __SpecialOutputBrand: true;
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly port: OutputPortReference<T>;
}
