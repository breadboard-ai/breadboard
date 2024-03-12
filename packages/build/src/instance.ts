/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputPort,
  OutputPort,
  type PortConfigMap,
  type ValuesOrOutputPorts,
} from "./port.js";

/**
 * An instance of a Breadboard node, constructed from a Breadboard node
 * definition.
 */
export class NodeInstance<I extends PortConfigMap, O extends PortConfigMap> {
  readonly inputs: InputPorts<I>;
  readonly outputs: OutputPorts<O>;
  readonly params: ValuesOrOutputPorts<I>;
  constructor(inputs: I, outputs: O, params: ValuesOrOutputPorts<I>) {
    this.inputs = inputPortsFromPortConfigMap(inputs);
    this.outputs = outputPortsFromPortConfigMap(outputs);
    this.params = params;
  }
}

function inputPortsFromPortConfigMap<I extends PortConfigMap>(
  inputs: I
): InputPorts<I> {
  return Object.fromEntries(
    Object.entries(inputs).map(([name, config]) => [
      name,
      new InputPort(config),
    ])
  ) as InputPorts<I>;
}

function outputPortsFromPortConfigMap<O extends PortConfigMap>(
  outputs: O
): OutputPorts<O> {
  return Object.fromEntries(
    Object.entries(outputs).map(([name, config]) => [
      name,
      new OutputPort(config),
    ])
  ) as OutputPorts<O>;
}

type InputPorts<I extends PortConfigMap> = {
  [PortName in keyof I]: InputPort<I[PortName]>;
};

type OutputPorts<O extends PortConfigMap> = {
  [PortName in keyof O]: OutputPort<O[PortName]>;
};

export type InstantiateParams<Ports extends PortConfigMap> =
  ValuesOrOutputPorts<Ports>;
