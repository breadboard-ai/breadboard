/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberResult,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";
import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type PortConfigMap,
  type ValuesOrOutputPorts,
  type ConcreteValues,
  type PrimaryOutputPort,
} from "./port.js";
import type { InputPorts, OutputPorts } from "./instance.js";
import type { StrictNodeHandler } from "./definition.js";
import { shapeToJSONSchema } from "./json-schema.js";

export function defineMonomorphicNodeType<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
>(
  name: string,
  inputs: ISHAPE,
  outputs: OSHAPE,
  invoke: MonomorphicInvokeFunction<ISHAPE, OSHAPE>
): MonomorphicDefinition<ISHAPE, OSHAPE> {
  const def = new MonomorphicNodeDefinition(name, inputs, outputs, invoke);
  return Object.assign(def.instantiate.bind(def), {
    describe: def.describe.bind(def),
    invoke: def.invoke.bind(def),
  });
}

class MonomorphicNodeDefinition<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> implements StrictNodeHandler
{
  readonly #name: string;
  readonly #inputs: ISHAPE;
  readonly #outputs: OSHAPE;
  readonly #invoke: MonomorphicInvokeFunction<ISHAPE, OSHAPE>;
  readonly #description: Promise<NodeDescriberResult>;

  constructor(
    name: string,
    inputs: ISHAPE,
    outputs: OSHAPE,
    invoke: MonomorphicInvokeFunction<ISHAPE, OSHAPE>
  ) {
    this.#name = name;
    this.#inputs = inputs;
    this.#outputs = outputs;
    this.#invoke = invoke;
    this.#description = Promise.resolve({
      // Cast because this package uses the `JSONSchema4` type from
      // `@types/json-schema` which isn't quite identical to
      // `NodeDescriberResult` (but nearly).
      inputSchema: shapeToJSONSchema(this.#inputs) as Schema,
      outputSchema: shapeToJSONSchema(this.#outputs) as Schema,
    });
  }

  instantiate<VALUES extends Record<string, unknown>>(
    values: MonomorphicInputValues<ISHAPE, VALUES>
  ): MonomorphicNodeInstance<ISHAPE, OSHAPE> {
    return new MonomorphicNodeInstance(
      this.#name,
      this.#inputs,
      this.#outputs,
      values
    );
  }

  describe(): Promise<NodeDescriberResult> {
    return this.#description;
  }

  invoke(values: InputValues): Promise<OutputValues> {
    return Promise.resolve(
      this.#invoke(
        // Cast needed because Breadboard runtimes do not guarantee that the
        // input shapes conform to schema.
        //
        // TODO(aomarks) Validate schema before passing to invoke function.
        values as ConcreteValues<ISHAPE>
      ) as OutputValues
    );
  }
}

class MonomorphicNodeInstance<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> {
  readonly inputs: InputPorts<ISHAPE>;
  readonly outputs: OutputPorts<OSHAPE>;
  readonly type: string;
  readonly #values: ValuesOrOutputPorts<ISHAPE>;
  readonly [OutputPortGetter]!: PrimaryOutputPort<OSHAPE>;

  constructor(
    name: string,
    inputs: ISHAPE,
    outputs: OSHAPE,
    values: ValuesOrOutputPorts<ISHAPE>
  ) {
    this.type = name;
    this.#values = values;
    this.inputs = Object.fromEntries(
      Object.entries(inputs).map(([name, config]) => [
        name,
        new InputPort(config, name, this, values[name]),
      ])
    ) as InputPorts<ISHAPE>;
    this.outputs = Object.fromEntries(
      Object.entries(outputs).map(([name, config]) => [
        name,
        new OutputPort(config, name, this),
      ])
    ) as OutputPorts<OSHAPE>;
    const primaryOutputPortNames = Object.keys(
      Object.entries(outputs).filter(([, config]) => config.primary)
    );
    if (primaryOutputPortNames.length === 1) {
      this[OutputPortGetter] = this.outputs[
        primaryOutputPortNames[0]!
        // TODO(aomarks) It might be possible to avoid this cast.
      ] as unknown as PrimaryOutputPort<OSHAPE>;
    } else if (primaryOutputPortNames.length > 0) {
      throw new Error(
        `Node was configured with >1 primary output nodes: ${primaryOutputPortNames.join(" ")}`
      );
    }
  }
}

export type MonomorphicDefinition<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = MonomorphicInstantiateFunction<ISHAPE, OSHAPE> & StrictNodeHandler;

export type MonomorphicInvokeFunction<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = (
  params: ConcreteValues<ISHAPE>
) => ConcreteValues<OSHAPE> | Promise<ConcreteValues<OSHAPE>>;

type MonomorphicInstantiateFunction<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = <VALUES extends Record<string, unknown>>(
  values: MonomorphicInputValues<ISHAPE, VALUES>
) => MonomorphicNodeInstance<ISHAPE, OSHAPE>;

type MonomorphicInputValues<
  ISHAPE extends PortConfigMap,
  VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<ISHAPE> & {
  [PORT_NAME in keyof VALUES]: PORT_NAME extends keyof ISHAPE
    ? ValuesOrOutputPorts<ISHAPE>[PORT_NAME]
    : never;
};
