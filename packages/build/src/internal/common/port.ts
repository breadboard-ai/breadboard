/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Input, InputWithDefault } from "../board/input.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";
import type { GenericBreadboardNodeInstance } from "./instance.js";

export type PortConfig = StaticPortConfig | DynamicPortConfig;

/**
 * Configuration parameters for a static Breadboard node port. A port is static
 * if it always exists for all instances of a node type.
 */
interface StaticPortConfig {
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
interface DynamicPortConfig extends StaticPortConfig {
  /**
   * The `primary` property should never be set on a dynamic port config,
   * because it is not possible for a dynamic port to be primary.
   */
  primary?: never;
}

// TODO(aomarks) Just make this a normal property, no need to export (it was
// originally a symbol to try and make a package-private API).
export const OutputPortGetter = "__output";

/**
 * A Breadboard node port which receives values.
 */
export class InputPort<T extends JsonSerializable> {
  readonly type: BreadboardType;
  readonly name: string;
  readonly node: GenericBreadboardNodeInstance;
  readonly value?: ValueOrOutputPort<T>;
  readonly #fakeForTypeDiscrimination!: T;

  constructor(
    type: BreadboardType,
    name: string,
    node: GenericBreadboardNodeInstance,
    value: ValueOrOutputPort<T>
  ) {
    this.type = type;
    this.name = name;
    this.node = node;
    this.value = value;
  }
}

/**
 * A Breadboard node port which sends values.
 */
export class OutputPort<T extends JsonSerializable>
  implements OutputPortReference<T>
{
  readonly [OutputPortGetter] = this;
  readonly type: BreadboardType;
  readonly name: string;
  readonly node: GenericBreadboardNodeInstance;
  readonly #fakeForTypeDiscrimination!: T;

  constructor(
    type: BreadboardType,
    name: string,
    node: GenericBreadboardNodeInstance
  ) {
    this.type = type;
    this.name = name;
    this.node = node;
  }
}

export interface OutputPortReference<T extends JsonSerializable> {
  readonly [OutputPortGetter]: OutputPort<T>;
}

export function isOutputPortReference(
  value: unknown
): value is OutputPortReference<JsonSerializable> {
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

export type PortTypes = Record<string, JsonSerializable>;

export type ExtractPortTypesFromConfigs<CONFIGS extends PortConfigMap> = {
  [NAME in keyof CONFIGS]: ConvertBreadboardType<CONFIGS[NAME]["type"]>;
};

export type ValuesOrOutputPorts<TYPES extends PortTypes> = {
  [NAME in keyof TYPES]: ValueOrOutputPort<TYPES[NAME]>;
};

export type PrimaryOutputPort<O extends PortConfigMap> =
  GetPrimaryPortType<O> extends never
    ? undefined
    : OutputPort<ConvertBreadboardType<GetPrimaryPortType<O>>>;

type GetPrimaryPortType<Ports extends PortConfigMap> = {
  [Name in keyof Ports]: Ports[Name] extends { primary: true }
    ? Ports[Name]
    : never;
}[keyof Ports]["type"];

export type InputPorts<I extends PortConfigMap> = {
  [PortName in keyof I]: InputPort<ConvertBreadboardType<I[PortName]["type"]>>;
};

export type OutputPorts<O extends PortConfigMap> = {
  [PortName in keyof O]: OutputPort<ConvertBreadboardType<O[PortName]["type"]>>;
};

export type ValueOrOutputPort<T extends JsonSerializable> =
  | T
  | OutputPortReference<T>
  | Input<T>
  | InputWithDefault<T>;

// export type InputValue<T extends JsonSerializable> =
//   | { raw: T }
//   | { port: OutputPortReference<T> }
//   | { input: InputWithoutDefault<T> | InputWithDefault<T> };
