/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardType,
  TypeScriptTypeFromBreadboardType,
} from "./type.js";

export type PortConfig = StaticPortConfig | DynamicPortConfig;

/**
 * Configuration parameters for a static Breadboard node port. A port is static
 * if it always exists for all instances of a node type.
 */
export interface StaticPortConfig {
  /**
   * The {@link BreadboardType} that values sent or received on this port will
   * be required to conform to.
   */
  type: BreadboardType;

  /**
   * An optional brief description of this port. Useful when introspecting and
   * debugging.
   */
  description?: string;

  /**
   * If true, this port is is the `primary` input or output port of the node it
   * belongs to.
   *
   * When a node definition has one primary input port, and/or one primary
   * output port, then instances of that node will themselves behave like that
   * primary input and/or output ports, depending on the context. Note that it
   * is an error for a node to have more than 1 primary input ports, or more
   * than 1 primary output ports.
   *
   * For example, an LLM node might have a primary input for `prompt`, and a
   * primary output for `completion`. This would mean that in API locations
   * where an input port is expected, instead of writing `llm.inputs.prompt`,
   * one could simply write `llm`, and the `prompt` port will be selected
   * automatically. Likewise for `completion`, where `llm` would be equivalent
   * to `llm.outputs.completion` where an output port is expected.
   *
   * Note this has no effect on Breadboard runtime behavior, it is purely a hint
   * to the JavaScript/TypeScript API to help make board construction more
   * concise.
   */
  primary?: boolean;
}

/**
 * Configuration parameters that apply to all dynamic Breadboard ports on a
 * node.
 *
 * A port is dynamic if its existence, name, type, or other metadata can be
 * different across different instances of a node type.
 */
export interface DynamicPortConfig {
  /**
   * The {@link BreadboardType} that values sent or received on these ports will
   * be required to conform to.
   */
  type: BreadboardType;

  /**
   * An optional brief description for each port. Useful when introspecting and
   * debugging.
   */
  description?: string;

  /**
   * The `primary` property should never be set on a dynamic port config,
   * because it is not possible for a dynamic port to be primary.
   */
  primary?: never;
}

export const OutputPortGetter = Symbol();

/**
 * A Breadboard node port which receives values.
 */
export class InputPort<I extends StaticPortConfig> {
  readonly __InputPortBrand__!: never;
  readonly type: I["type"];

  constructor(config: I) {
    this.type = config.type;
  }
}

/**
 * A Breadboard node port which sends values.
 */
export class OutputPort<O extends StaticPortConfig>
  implements OutputPortReference<O>
{
  readonly [OutputPortGetter] = this;
  readonly type: O["type"];

  constructor(config: O) {
    this.type = config.type;
  }
}

export interface OutputPortReference<O extends StaticPortConfig> {
  readonly [OutputPortGetter]: OutputPort<O>;
}

/**
 * A map from port name to port config.
 *
 * TODO(aomarks) Should be deleted, because we shouldn't have any API which
 * doesn't understand Dynamic ports.
 */
export type StaticPortConfigMap = Record<string, StaticPortConfig>;

/**
 * A map from port name to port config.
 */
export type PortConfigMap = Record<string, PortConfig>;

/**
 * Convert a {@link StaticPortConfigMap} to an object with concrete values for each
 * port.
 */
export type ConcreteValues<Ports extends StaticPortConfigMap> = {
  [PortName in keyof Ports]: TypeScriptTypeFromBreadboardType<
    Ports[PortName]["type"]
  >;
};

/**
 * Convert a {@link StaticPortConfigMap} to an object with either concrete values for
 * each port, or an output port for each port.
 */
export type ValuesOrOutputPorts<Ports extends StaticPortConfigMap> = {
  [PortName in keyof Ports]:
    | TypeScriptTypeFromBreadboardType<Ports[PortName]["type"]>
    | OutputPortReference<Ports[PortName]>;
};
