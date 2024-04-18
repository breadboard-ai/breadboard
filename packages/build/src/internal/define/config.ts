/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BreadboardType } from "../type-system/type.js";

export type PortConfig = InputPortConfig | OutputPortConfig;
export type PortConfigs = Record<string, PortConfig>;

export type InputPortConfig = StaticInputPortConfig | DynamicInputPortConfig;
export type OutputPortConfig = StaticOutputPortConfig | DynamicOutputPortConfig;

interface BaseConfig {
  type: BreadboardType;
  description?: string;
  multiline?: true;
}

export interface StaticInputPortConfig extends BaseConfig {
  primary?: true;
}

export interface DynamicInputPortConfig extends BaseConfig {}

export interface StaticOutputPortConfig extends BaseConfig {
  primary?: true;
}

export interface DynamicOutputPortConfig extends BaseConfig {
  reflective?: true;
}
