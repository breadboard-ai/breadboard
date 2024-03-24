/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ValueOrOutputPort } from "./definition.js";
import type { GenericBreadboardNodeInstance } from "./node.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
} from "./type-system/type.js";

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
export class InputPort<I extends PortConfig> {
  readonly __InputPortBrand__!: never;
  readonly type: I["type"];
  readonly name: string;
  readonly node: GenericBreadboardNodeInstance;
  readonly value?: ValueOrOutputPort<I>;

  constructor(
    config: I,
    name: string,
    node: GenericBreadboardNodeInstance,
    value: ValueOrOutputPort<I>
  ) {
    this.type = config.type;
    this.name = name;
    this.node = node;
    this.value = value;
  }
}

/**
 * A Breadboard node port which sends values.
 */
export class OutputPort<O extends PortConfig>
  implements OutputPortReference<O>
{
  readonly [OutputPortGetter] = this;
  readonly type: O["type"];
  readonly name: string;
  readonly node: GenericBreadboardNodeInstance;

  constructor(config: O, name: string, node: GenericBreadboardNodeInstance) {
    this.type = config.type;
    this.name = name;
    this.node = node;
  }
}

export interface OutputPortReference<O extends PortConfig> {
  readonly [OutputPortGetter]: OutputPort<O>;
}

export function isOutputPortReference(
  value: unknown
): value is OutputPortReference<PortConfig> {
  return (
    typeof value === "object" && value !== null && OutputPortGetter in value
  );
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
  [PortName in keyof Ports]: ConvertBreadboardType<Ports[PortName]["type"]>;
};

/**
 * Convert a {@link PortConfigMap} to an object with either concrete values for
 * each port, or an output port for each port.
 */
export type ValuesOrOutputPorts<Ports extends PortConfigMap> = {
  [PortName in keyof Ports]:
    | ConvertBreadboardType<Ports[PortName]["type"]>
    | OutputPortReference<Ports[PortName]>;
};
export type PrimaryOutputPort<O extends PortConfigMap> =
  GetPrimaryPortType<O> extends never
    ? undefined
    : OutputPort<{ type: GetPrimaryPortType<O> }>;
export type GetPrimaryPortType<Ports extends PortConfigMap> = {
  [Name in keyof Ports]: Ports[Name] extends { primary: true }
    ? Ports[Name]
    : never;
}[keyof Ports]["type"];
