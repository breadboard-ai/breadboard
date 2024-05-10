/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Input, InputWithDefault } from "../board/input.js";
import type { Loopback } from "../board/loopback.js";
import type { PortConfig } from "../define/config.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";
import type {
  SerializableInputPort,
  SerializableNode,
  SerializableOutputPort,
} from "./serializable.js";

// TODO(aomarks) Just make this a normal property, no need to export (it was
// originally a symbol to try and make a package-private API).
export const OutputPortGetter = "__output";

export const DefaultValue = Symbol();

/**
 * A Breadboard node port which receives values.
 */
export class InputPort<T extends JsonSerializable>
  implements SerializableInputPort
{
  readonly type: BreadboardType;
  readonly name: string;
  readonly node: SerializableNode;
  readonly value?: ValueOrOutputPort<T> | typeof DefaultValue;
  readonly #fakeForTypeDiscrimination!: T;

  constructor(
    type: BreadboardType,
    name: string,
    node: SerializableNode,
    value: ValueOrOutputPort<T> | typeof DefaultValue
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
  implements OutputPortReference<T>, SerializableOutputPort
{
  readonly [OutputPortGetter] = this;
  readonly type: BreadboardType;
  readonly name: string;
  readonly node: SerializableNode;
  readonly #fakeForTypeDiscrimination!: T;

  constructor(type: BreadboardType, name: string, node: SerializableNode) {
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
  | InputWithDefault<T>
  | Loopback<T>;
