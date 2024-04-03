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
import type { StrictNodeHandler } from "../common/compatibility.js";
import type { GenericBreadboardNodeInstance } from "../common/instance.js";
import type {
  ExtractPortTypesFromConfigs,
  InputPorts,
  OutputPorts,
} from "../common/port.js";
import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type ConcreteValues,
  type PortConfigMap,
  type PrimaryOutputPort,
  type ValuesOrOutputPorts,
} from "../common/port.js";
import { portConfigMapToJSONSchema } from "./json-schema.js";

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
      inputSchema: portConfigMapToJSONSchema(this.#inputs) as Schema,
      outputSchema: portConfigMapToJSONSchema(this.#outputs) as Schema,
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
  INPUT_CONFIGS extends PortConfigMap,
  OUTPUT_CONFIGS extends PortConfigMap,
> implements GenericBreadboardNodeInstance
{
  readonly inputs: InputPorts<INPUT_CONFIGS>;
  readonly outputs: OutputPorts<OUTPUT_CONFIGS>;
  readonly type: string;
  readonly [OutputPortGetter]!: PrimaryOutputPort<OUTPUT_CONFIGS>;

  constructor(
    name: string,
    inputs: INPUT_CONFIGS,
    outputs: OUTPUT_CONFIGS,
    values: ValuesOrOutputPorts<ExtractPortTypesFromConfigs<INPUT_CONFIGS>>
  ) {
    this.type = name;
    this.inputs = Object.fromEntries(
      Object.entries(inputs).map(([name, config]) => [
        name,
        // TODO(aomarks) Can we remove this `!`?
        new InputPort(config.type, name, this, values[name]!),
      ])
    ) as InputPorts<INPUT_CONFIGS>;
    this.outputs = Object.fromEntries(
      Object.entries(outputs).map(([name, config]) => [
        name,
        new OutputPort(config.type, name, this),
      ])
    ) as OutputPorts<OUTPUT_CONFIGS>;
    const primaryOutputPortNames = Object.entries(outputs)
      .filter(([, config]) => config.primary)
      .map(([name]) => name);
    if (primaryOutputPortNames.length === 1) {
      this[OutputPortGetter] = this.outputs[
        primaryOutputPortNames[0]!
        // TODO(aomarks) It might be possible to avoid this cast.
      ] as unknown as PrimaryOutputPort<OUTPUT_CONFIGS>;
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
  INPUT_CONFIGS extends PortConfigMap,
  VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<ExtractPortTypesFromConfigs<INPUT_CONFIGS>> & {
  // This is a trick for making type errors for excess properties more useful.
  // We take a broad type for VALUES, but then override any of its properties
  // that we don't recognize with never. This way, the red squiggly will appear
  // under the exact excess property, instead of over the whole object.
  [PORT_NAME in keyof VALUES]: PORT_NAME extends keyof INPUT_CONFIGS
    ? ValuesOrOutputPorts<ExtractPortTypesFromConfigs<INPUT_CONFIGS>>[PORT_NAME]
    : never;
};
