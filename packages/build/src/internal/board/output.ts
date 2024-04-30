/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";

export function output<T extends JsonSerializable>(
  port: OutputPortReference<T>,
  params?: { id?: string }
): Output<T> {
  return { __SpecialOutputBrand: true, id: params?.id, port };
}

export interface Output<T extends JsonSerializable> {
  readonly __SpecialOutputBrand: true;
  readonly id?: string;
  readonly port: OutputPortReference<T>;
  // TODO(aomarks) Add description etc.
}
