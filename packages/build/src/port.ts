/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BreadboardType } from "./type.js";

/**
 * Configuration parameters for a Breadboard node port.
 */
export interface PortConfig {
  /**
   * The {@link BreadboardType} that values sent or received on this port will
   * be required to conform to.
   */
  type: BreadboardType;

  /**
   * An optional brief description of this node type. Useful when introspecting
   * and debugging.
   */
  description?: string;
}

/**
 * A Breadboard node port which receives values.
 */
export class InputPort<I extends PortConfig> {
  constructor(_config: I) {}
}

/**
 * A Breadboard node port which sends values.
 */
export class OutputPort<O extends PortConfig> {
  constructor(_config: O) {}
}

/**
 * A map from port name to port config.
 */
export type PortConfigMap = Record<string, PortConfig>;
