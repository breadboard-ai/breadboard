/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonSerializable } from "../type-system/type.js";
import type { InputPort, OutputPortReference } from "./port.js";

export interface BreadboardNodeInstance<
  INPUT_PORTS extends Record<string, InputPort<JsonSerializable>>,
  OUTPUT_PORTS extends Record<string, OutputPortReference<JsonSerializable>>,
> {
  type: string;
  inputs: INPUT_PORTS;
  outputs: OUTPUT_PORTS;
}

export type GenericBreadboardNodeInstance = BreadboardNodeInstance<
  Record<string, InputPort<JsonSerializable>>,
  Record<string, OutputPortReference<JsonSerializable>>
>;
