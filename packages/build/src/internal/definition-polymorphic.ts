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
import type { StrictNodeHandler, ValueOrPort } from "./definition.js";
import type { InputPorts, OutputPorts } from "./instance.js";
import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type PortConfigMap,
  type ValuesOrOutputPorts,
  type ConcreteValues,
  type PrimaryOutputPort,
  type PortConfig,
} from "./port.js";
import type { TypeScriptTypeFromBreadboardType } from "./type.js";
import { shapeToJSONSchema } from "./json-schema.js";

/**
 * Define a Breadboard node type where some or all of its input and/or output
 * ports can change dynamically during execution.
 *
 * TODO(aomarks) Add dynamicOutputs.
 *
 * @param staticInputs The input ports which never change.
 * @param dynamicInputs Constraints on the input ports which can change.
 * @param staticOutputs The output ports which never change.
 * @param invoke A function that will be called when an instance of this node
 * type is running.
 * @param describe A function that will be called to find out what the current
 * set of dynamic ports are.
 * @returns A {@link PolymorphicDefinition}.
 */
export function definePolymorphicNodeType<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
>(
  staticInputs: STATIC_INPUTS,
  dynamicInputs: DYNAMIC_INPUTS,
  staticOutputs: STATIC_OUTPUTS,
  invoke: PolymorphicInvokeFunction<
    STATIC_INPUTS,
    DYNAMIC_INPUTS,
    STATIC_OUTPUTS
  >,
  // TODO(aomarks) Make this required. It's hard to get the main `define` schema
  // to enforce this correctly, though (so maybe we should just expose the
  // separate functions directly).
  describe?: PolymorphicDescribeFunction<STATIC_INPUTS, DYNAMIC_INPUTS>
): PolymorphicDefinition<STATIC_INPUTS, DYNAMIC_INPUTS, STATIC_OUTPUTS> {
  const definition = new PolymorphicNodeDefinition(
    staticInputs,
    dynamicInputs,
    staticOutputs,
    invoke,
    describe
  );
  const instantiate = definition.instantiate.bind(definition);
  const handler = {
    describe: definition.describe.bind(definition),
    invoke: definition.invoke.bind(definition),
  };
  return Object.assign(instantiate, handler);
}

/**
 * A function that will be called on an instance of a polymorphic node to find
 * out what the current set of dynamic ports are.
 */
export type PolymorphicDescribeFunction<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
> = (staticInputs: Partial<StaticInvokeParams<STATIC_INPUTS>>) => {
  inputs: Record<
    string,
    {
      // TODO(aomarks) Actually anything *assignable* to DYNAMIC_INPUTS["type"] should
      // also be allowed.
      type: DYNAMIC_INPUTS["type"];
      description?: string;
    }
  >;
};

class PolymorphicNodeDefinition<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
> implements StrictNodeHandler
{
  readonly #staticInputs: STATIC_INPUTS;
  readonly #staticOutputs: STATIC_OUTPUTS;
  readonly #invoke: PolymorphicInvokeFunction<
    STATIC_INPUTS,
    DYNAMIC_INPUTS,
    STATIC_OUTPUTS
  >;
  readonly #describe?: PolymorphicDescribeFunction<
    STATIC_INPUTS,
    DYNAMIC_INPUTS
  >;
  readonly #staticDescription: NodeDescriberResult;

  constructor(
    staticInputs: STATIC_INPUTS,
    _dynamicInputs: DYNAMIC_INPUTS,
    staticOutputs: STATIC_OUTPUTS,
    invoke: PolymorphicInvokeFunction<
      STATIC_INPUTS,
      DYNAMIC_INPUTS,
      STATIC_OUTPUTS
    >,
    describe?: PolymorphicDescribeFunction<STATIC_INPUTS, DYNAMIC_INPUTS>
  ) {
    this.#staticInputs = staticInputs;
    this.#staticOutputs = staticOutputs;
    this.#invoke = invoke;
    this.#describe = describe;
    this.#staticDescription = {
      inputSchema: shapeToJSONSchema(this.#staticInputs),
      outputSchema: shapeToJSONSchema(this.#staticOutputs),
    };
  }

  instantiate<INSTANTIATE_VALUES extends Record<string, unknown>>(
    instantiateValues: PolymorphicInstantiateValues<
      STATIC_INPUTS,
      DYNAMIC_INPUTS,
      INSTANTIATE_VALUES
    >
  ): PolymorphicNodeInstance<
    STATIC_INPUTS,
    DYNAMIC_INPUTS,
    STATIC_OUTPUTS,
    INSTANTIATE_VALUES
  > {
    return new PolymorphicNodeInstance(
      this.#staticInputs,
      this.#staticOutputs,
      instantiateValues
    );
  }

  async describe(
    runtimeInputValues?: InputValues
  ): Promise<NodeDescriberResult> {
    if (this.#describe === undefined) {
      // TODO(aomarks) It shouldn't actually be allowed to omit describe for a
      // polymorphic node.
      return this.#staticDescription;
    }
    // TODO(aomarks) Should we also pass the dynamic values?
    const { staticValues } = this.#partitionRuntimeInputValues(
      runtimeInputValues ?? {}
    );
    const dynamicSchema = await this.#describe(staticValues);
    const dynamicInputs = shapeToJSONSchema(dynamicSchema.inputs);
    const { inputSchema: staticInputs, outputSchema: staticOutputs } =
      this.#staticDescription;
    return {
      inputSchema: {
        ...staticInputs,
        properties: {
          ...dynamicInputs.properties,
          ...staticInputs.properties,
        },
        required: [
          ...(staticInputs.required ?? []),
          ...(dynamicInputs.required ?? []),
        ],
      },
      // TODO(aomarks) Also support dynamic output schema (but only if there are
      // dynamic outputs declared).
      outputSchema: staticOutputs,
    };
  }

  invoke(values: InputValues): Promise<OutputValues> {
    const { staticValues, dynamicValues } =
      this.#partitionRuntimeInputValues(values);
    return Promise.resolve(
      this.#invoke(staticValues, dynamicValues) as OutputValues
    );
  }

  /**
   * Split the values between static and dynamic ports. We do this for type
   * safety, because in TypeScript it is unfortunately not possible to define an
   * object where the values of the unknown keys are of one type, and the known
   * keys are of an incompatible type.
   */
  #partitionRuntimeInputValues(values: InputValues): {
    staticValues: StaticInvokeParams<STATIC_INPUTS>;
    dynamicValues: DynamicInvokeParams<STATIC_INPUTS, DYNAMIC_INPUTS>;
  } {
    const staticValues: Record<string, unknown> = {};
    const dynamicValues: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(values)) {
      if (this.#staticInputs[name] !== undefined) {
        staticValues[name] = value;
      } else {
        dynamicValues[name] = value;
      }
    }
    return {
      // Cast needed because Breadboard runtimes do not guarantee that the
      // input shapes conform to schema.
      //
      // TODO(aomarks) Validate schema before passing to invoke function.
      staticValues: staticValues as StaticInvokeParams<STATIC_INPUTS>,
      dynamicValues: dynamicValues as DynamicInvokeParams<
        STATIC_INPUTS,
        DYNAMIC_INPUTS
      >,
    };
  }
}

class PolymorphicNodeInstance<
  STATIC_INPUTS extends PortConfigMap,
  // TODO(aomarks) Change to DynamicPortConfig
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
  VALUES extends Record<string, unknown>,
> {
  readonly inputs: InputPorts<STATIC_INPUTS>;
  readonly outputs: OutputPorts<STATIC_OUTPUTS>;
  // TODO(aomarks) This will be used during serialization.
  readonly #_inputValues: PolymorphicInstantiateValues<
    STATIC_INPUTS,
    DYNAMIC_INPUTS,
    VALUES
  >;
  readonly [OutputPortGetter]!: PrimaryOutputPort<STATIC_OUTPUTS>;
  readonly #_temp!: DYNAMIC_INPUTS;

  constructor(
    inputShape: STATIC_INPUTS,
    outputShape: STATIC_OUTPUTS,
    inputValues: PolymorphicInstantiateValues<
      STATIC_INPUTS,
      DYNAMIC_INPUTS,
      VALUES
    >
  ) {
    this.inputs = Object.fromEntries(
      Object.entries(inputShape).map(([portName, portConfig]) => [
        portName,
        new InputPort(portConfig),
      ])
    ) as InputPorts<STATIC_INPUTS>;
    this.outputs = Object.fromEntries(
      Object.entries(outputShape).map(([portName, portConfig]) => [
        portName,
        new OutputPort(portConfig),
      ])
    ) as OutputPorts<STATIC_OUTPUTS>;
    this.#_inputValues = inputValues;
  }
}

type PolymorphicInstantiateValues<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<STATIC_INPUTS> & {
  [PORT_NAME in keyof VALUES]: PORT_NAME extends keyof STATIC_INPUTS
    ? ValueOrPort<STATIC_INPUTS[PORT_NAME]>
    : ValueOrPort<DYNAMIC_INPUTS>;
};

export type PolymorphicInvokeFunction<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
> = (
  staticParams: StaticInvokeParams<STATIC_INPUTS>,
  dynamicParams: DynamicInvokeParams<STATIC_INPUTS, DYNAMIC_INPUTS>
) => InvokeReturn<STATIC_OUTPUTS> | Promise<InvokeReturn<STATIC_OUTPUTS>>;

type StaticInvokeParams<Ports extends PortConfigMap> = ConcreteValues<Ports>;

type DynamicInvokeParams<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
> = Record<keyof STATIC_INPUTS, never> &
  Record<string, TypeScriptTypeFromBreadboardType<DYNAMIC_INPUTS["type"]>>;

type InvokeReturn<Ports extends PortConfigMap> = ConcreteValues<Ports>;

export type PolymorphicInstantiateFunction<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
> = <VALUES extends Record<string, unknown>>(
  values: PolymorphicInstantiateValues<STATIC_INPUTS, DYNAMIC_INPUTS, VALUES>
) => PolymorphicNodeInstance<
  STATIC_INPUTS,
  DYNAMIC_INPUTS,
  STATIC_OUTPUTS,
  VALUES
>;

export type PolymorphicDefinition<
  STATIC_INPUTS extends PortConfigMap,
  DYNAMIC_INPUTS extends PortConfig,
  STATIC_OUTPUTS extends PortConfigMap,
> = PolymorphicInstantiateFunction<
  STATIC_INPUTS,
  DYNAMIC_INPUTS,
  STATIC_OUTPUTS
> &
  StrictNodeHandler;
