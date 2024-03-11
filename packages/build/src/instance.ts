/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputPort, OutputPort, type PortConfigMap } from "./port.js";

/**
 * An instance of a Breadboard node, constructed from a Breadboard node
 * definition.
 */
export class NodeInstance<I extends PortConfigMap, O extends PortConfigMap> {
  readonly inputs: InputPorts<I>;
  readonly outputs: OutputPorts<O>;
  constructor(inputs: I, outputs: O) {
    this.inputs = inputPortsFromPortConfigMap(inputs);
    this.outputs = outputPortsFromPortConfigMap(outputs);
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
  ) as InputPorts<O>;
}

type InputPorts<I extends PortConfigMap> = {
  [PortName in keyof I]: InputPort<I[PortName]>;
};

type OutputPorts<O extends PortConfigMap> = {
  [PortName in keyof O]: OutputPort<O[PortName]>;
};
