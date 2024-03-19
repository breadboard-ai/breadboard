/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberResult,
  OutputValues,
} from "@google-labs/breadboard";
import type {
  OmitStarPort,
  StrictNodeHandler,
  ValueOrPort,
} from "./definition.js";
import type { InputPorts, OutputPorts } from "./instance.js";
import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type PortConfigMap,
  type ValuesOrOutputPorts,
  type ConcreteValues,
  type PrimaryOutputPort,
} from "./port.js";
import type { TypeScriptTypeFromBreadboardType } from "./type.js";
import { shapeToJSONSchema } from "./json-schema.js";

export function definePolymorphicNodeType<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
>(
  inputs: ISHAPE,
  outputs: OSHAPE,
  invoke: PolymorphicInvokeFunction<ISHAPE, OSHAPE>
): PolymorphicDefinition<ISHAPE, OSHAPE> {
  const def = new PolymorphicNodeDefinition(inputs, outputs, invoke);
  const instantiate = def.instantiate.bind(def);
  const handler: StrictNodeHandler = {
    describe: def.describe.bind(def),
    invoke: def.invoke.bind(def),
  };
  return Object.assign(instantiate, handler);
}

class PolymorphicNodeDefinition<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> implements StrictNodeHandler
{
  readonly #inputs: ISHAPE;
  readonly #outputs: OSHAPE;
  readonly #invoke: PolymorphicInvokeFunction<ISHAPE, OSHAPE>;

  constructor(
    inputs: ISHAPE,
    outputs: OSHAPE,
    invoke: PolymorphicInvokeFunction<ISHAPE, OSHAPE>
  ) {
    this.#inputs = inputs;
    this.#outputs = outputs;
    this.#invoke = invoke;
  }

  instantiate<VALUES extends Record<string, unknown>>(
    values: PolymorphicInputValues<ISHAPE, VALUES>
  ) {
    return new PolymorphicNodeInstance<ISHAPE, OSHAPE, VALUES>(
      this.#inputs,
      this.#outputs,
      values
    );
  }

  describe(): Promise<NodeDescriberResult> {
    // TODO(aomarks) Take the values and update the schema.
    return Promise.resolve({
      inputSchema: shapeToJSONSchema(omitDynamicPort(this.#inputs)),
      outputSchema: shapeToJSONSchema(omitDynamicPort(this.#outputs)),
    });
  }

  invoke(values: InputValues): Promise<OutputValues> {
    // Split the values between static and dynamic ports. We do this for type
    // safety, because in TypeScript it is unfortunately not possible to define
    // an object where the values of the unknown keys are of one type, and the
    // known keys are of an incompatible type.
    const staticValues: Record<string, unknown> = {};
    const dynamicValues: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(values)) {
      if (this.#inputs[name] !== undefined) {
        staticValues[name] = value;
      } else {
        dynamicValues[name] = value;
      }
    }
    return Promise.resolve(
      this.#invoke(
        // Cast needed because Breadboard runtimes do not guarantee that the
        // input shapes conform to schema.
        //
        // TODO(aomarks) Validate schema before passing to invoke function.
        staticValues as StaticInvokeParams<ISHAPE>,
        dynamicValues as DynamicInvokeParams<ISHAPE>
      ) as OutputValues
    );
  }
}

class PolymorphicNodeInstance<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
  VALUES extends Record<string, unknown>,
> {
  readonly inputs: InputPorts<ISHAPE>;
  readonly outputs: OutputPorts<OSHAPE>;
  // TODO(aomarks) This will be used during serialization.
  readonly #_inputValues: PolymorphicInputValues<ISHAPE, VALUES>;
  readonly [OutputPortGetter]!: PrimaryOutputPort<OSHAPE>;

  constructor(
    inputShape: ISHAPE,
    outputShape: OSHAPE,
    inputValues: PolymorphicInputValues<ISHAPE, VALUES>
  ) {
    this.inputs = Object.fromEntries(
      Object.entries(omitDynamicPort(inputShape)).map(
        ([portName, portConfig]) => [portName, new InputPort(portConfig)]
      )
    ) as InputPorts<ISHAPE>;
    this.outputs = Object.fromEntries(
      Object.entries(omitDynamicPort(outputShape)).map(
        ([portName, portConfig]) => [portName, new OutputPort(portConfig)]
      )
    ) as OutputPorts<OSHAPE>;
    this.#_inputValues = inputValues;
  }
}

export function omitDynamicPort<SHAPE extends PortConfigMap>(
  shape: SHAPE
): OmitDynamicPort<SHAPE> {
  return Object.fromEntries(
    Object.entries(shape).filter(([name]) => name !== "*")
  ) as Omit<SHAPE, "*">;
}

type OmitDynamicPort<SHAPE extends PortConfigMap> = Omit<SHAPE, "*">;

type PolymorphicInputValues<
  ISHAPE extends PortConfigMap,
  VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<OmitStarPort<ISHAPE>> & {
  [PORT_NAME in keyof VALUES]: PORT_NAME extends keyof ISHAPE
    ? ValueOrPort<ISHAPE[PORT_NAME]>
    : ValueOrPort<ISHAPE["*"]>;
};

export type PolymorphicInvokeFunction<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = (
  staticParams: StaticInvokeParams<ISHAPE>,
  dynamicParams: DynamicInvokeParams<ISHAPE>
) => InvokeReturn<OSHAPE> | Promise<InvokeReturn<OSHAPE>>;

type StaticInvokeParams<Ports extends PortConfigMap> = Omit<
  ConcreteValues<Ports>,
  "*"
>;

type DynamicInvokeParams<I extends PortConfigMap> = Record<keyof I, never> &
  Record<string, TypeScriptTypeFromBreadboardType<I["*"]["type"]>>;

type InvokeReturn<Ports extends PortConfigMap> = ConcreteValues<Ports>;

export type PolymorphicInstantiateFunction<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = <VALUES extends Record<string, unknown>>(
  values: PolymorphicInputValues<ISHAPE, VALUES>
) => PolymorphicNodeInstance<ISHAPE, OSHAPE, VALUES>;

export type PolymorphicDefinition<
  ISHAPE extends PortConfigMap,
  OSHAPE extends PortConfigMap,
> = PolymorphicInstantiateFunction<ISHAPE, OSHAPE> & StrictNodeHandler;
