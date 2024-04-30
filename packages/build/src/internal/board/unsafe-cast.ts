/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OutputPort,
  OutputPortGetter,
  type OutputPortReference,
} from "../common/port.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

export function unsafeCast<
  O extends JsonSerializable,
  B extends BreadboardType,
>(
  output: OutputPortReference<O>,
  type: B
): OutputPortReference<ConvertBreadboardType<B>> {
  const actualOutput = output[OutputPortGetter];
  return new OutputPort(type, actualOutput.name, actualOutput.node);
}
