/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputPort,
  OutputPort,
  OutputPortGetter,
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
  readonly [OutputPortGetter]!: PrimaryOutputPort<O>;

  constructor(inputs: I, outputs: O, params: ValuesOrOutputPorts<I>) {
    this.inputs = inputPortsFromPortConfigMap(inputs);
    this.outputs = outputPortsFromPortConfigMap(outputs);
    this.params = params;

    const primaryOutputPortNames = Object.keys(
      Object.entries(outputs).filter(([, config]) => config.primary)
    );
    if (primaryOutputPortNames.length === 1) {
      this[OutputPortGetter] = this.outputs[
        primaryOutputPortNames[0]!
        // TODO(aomarks) It might be possible to avoid this cast.
      ] as unknown as PrimaryOutputPort<O>;
    } else if (primaryOutputPortNames.length > 0) {
      // TODO(aomarks) Also catch this error earlier, inside `defineNodeType`.
      throw new Error(
        `Node was configured with >1 primary output nodes: ${primaryOutputPortNames.join(" ")}`
      );
    }
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
    // TODO(aomarks) It might be possible to avoid this cast.
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
    // TODO(aomarks) It might be possible to avoid this cast.
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

type GetPrimaryPortType<Ports extends PortConfigMap> = {
  [Name in keyof Ports]: Ports[Name] extends { primary: true }
    ? Ports[Name]
    : never;
}[keyof Ports]["type"];

type PrimaryOutputPort<O extends PortConfigMap> =
  GetPrimaryPortType<O> extends never
    ? undefined
    : OutputPort<{ type: GetPrimaryPortType<O> }>;
