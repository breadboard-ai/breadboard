/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardType,
  TypeScriptTypeFromBreadboardType,
} from "./type.js";

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
  readonly __InputPortBrand__!: never;
  readonly type: I["type"];

  constructor(config: I) {
    this.type = config.type;
  }
}

/**
 * A Breadboard node port which sends values.
 */
export class OutputPort<O extends PortConfig> {
  readonly __OutputPortBrand__!: never;
  readonly type: O["type"];

  constructor(config: O) {
    this.type = config.type;
  }
}

/**
 * A map from port name to port config.
 */
export type PortConfigMap = Record<string, PortConfig>;

/**
 * Convert a {@link PortConfigMap} to an object with concrete values for each
 * port.
 */
export type ConcreteValues<Ports extends PortConfigMap> = {
  [PortName in keyof Ports]: TypeScriptTypeFromBreadboardType<
    Ports[PortName]["type"]
  >;
};

/**
 * Convert a {@link PortConfigMap} to an object with either concrete values for
 * each port, or an output port for each port.
 */
export type ValuesOrOutputPorts<Ports extends PortConfigMap> = {
  [PortName in keyof Ports]:
    | TypeScriptTypeFromBreadboardType<Ports[PortName]["type"]>
    | OutputPort<Ports[PortName]>;
};
