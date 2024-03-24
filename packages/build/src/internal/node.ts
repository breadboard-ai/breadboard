/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PortConfig, InputPort, OutputPortReference } from "./port.js";

export interface BreadboardNodeInstance<
  INPUT_PORTS extends Record<string, InputPort<PortConfig>>,
  OUTPUT_PORTS extends Record<string, OutputPortReference<PortConfig>>,
> {
  type: string;
  inputs: INPUT_PORTS;
  outputs: OUTPUT_PORTS;
}

export type GenericBreadboardNodeInstance = BreadboardNodeInstance<
  Record<string, InputPort<PortConfig>>,
  Record<string, OutputPortReference<PortConfig>>
>;
