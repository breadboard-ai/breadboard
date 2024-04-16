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
import type { JSONSchema4 } from "json-schema";
import type { Input, InputWithDefault } from "../board/input.js";
import type { Placeholder } from "../board/placeholder.js";
import type { StrictNodeHandler } from "../common/compatibility.js";
import type { OutputPortReference } from "../common/port.js";
import type { Expand } from "../common/type-util.js";
import type { JsonSerializable } from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  PortConfig,
  PortConfigs,
} from "./config.js";
import { Instance } from "./instance.js";
import { portConfigMapToJSONSchema } from "./json-schema.js";

export interface Definition<
  /* Static Inputs   */ SI extends { [K: string]: JsonSerializable },
  /* Static Outputs  */ SO extends { [K: string]: JsonSerializable },
  /* Dynamic Inputs  */ DI extends JsonSerializable | undefined,
  /* Dynamic Outputs */ DO extends JsonSerializable | undefined,
  /* Reflective?     */ R extends boolean,
  /* Primary Input   */ PI extends keyof SI | undefined,
  /* Primary Output  */ PO extends keyof SO | undefined,
> extends StrictNodeHandler {
  <A extends LooseInstantiateArgs>(
    args: A & StrictInstantiateArgs<SI, DI, A>
  ): Instance<
    InstanceInputs<SI, DI, A>,
    InstanceOutputs<SI, SO, DO, R, A>,
    R extends true ? undefined : DO,
    PI,
    PO,
    R
  >;
}

export class DefinitionImpl<
  /* Static Inputs   */ SI extends { [K: string]: JsonSerializable },
  /* Static Outputs  */ SO extends { [K: string]: JsonSerializable },
  /* Dynamic Inputs  */ DI extends JsonSerializable | undefined,
  /* Dynamic Outputs */ DO extends JsonSerializable | undefined,
  /* Reflective?     */ R extends boolean,
  /* Primary Input   */ PI extends keyof SI | undefined,
  /* Primary Output  */ PO extends keyof SO | undefined,
> implements StrictNodeHandler
{
  readonly #name: string;
  readonly #staticInputs: PortConfigs;
  readonly #staticOutputs: PortConfigs;
  readonly #dynamicInputs: DynamicInputPortConfig | undefined;
  readonly #dynamicOutputs: PortConfig | undefined;
  readonly #reflective: boolean;
  readonly #primaryInput: string | undefined;
  readonly #primaryOutput: string | undefined;
  // TODO(aomarks) Support promises
  readonly #invoke: (
    staticParams: Record<string, JsonSerializable>,
    dynamicParams: Record<string, JsonSerializable>
  ) => { [K: string]: JsonSerializable };
  readonly #describe?: (
    staticParams: Record<string, JsonSerializable>,
    dynamicParams: Record<string, JsonSerializable>
  ) => {
    inputs?: string[];
    outputs?: string[];
  };

  constructor(
    name: string,
    staticInputs: PortConfigs,
    staticOutputs: PortConfigs,
    dynamicInputs: PortConfig | undefined,
    dynamicOutputs: DynamicOutputPortConfig | undefined,
    primaryInput: string | undefined,
    primaryOutput: string | undefined,
    invoke: (
      staticParams: Record<string, JsonSerializable>,
      dynamicParams: Record<string, JsonSerializable>
    ) => { [K: string]: JsonSerializable },
    describe?: (
      staticParams: Record<string, JsonSerializable>,
      dynamicParams: Record<string, JsonSerializable>
    ) => {
      inputs?: string[];
      outputs?: string[];
    }
  ) {
    this.#name = name;
    this.#staticInputs = staticInputs;
    this.#staticOutputs = staticOutputs;
    this.#dynamicInputs = dynamicInputs;
    this.#dynamicOutputs = dynamicOutputs;
    this.#reflective = dynamicOutputs?.reflective ?? false;
    this.#primaryInput = primaryInput;
    this.#primaryOutput = primaryOutput;
    this.#invoke = invoke;
    this.#describe = describe;
  }

  instantiate<A extends LooseInstantiateArgs>(
    args: A & StrictInstantiateArgs<SI, DI, A>
  ): Instance<
    InstanceInputs<SI, DI, A>,
    InstanceOutputs<SI, SO, DO, R, A>,
    R extends true ? undefined : DO,
    PI,
    PO,
    R
  > {
    if (!args) {
      throw new Error("args is required");
    }
    return new Instance(
      this.#name,
      this.#staticInputs,
      this.#dynamicInputs,
      this.#staticOutputs,
      this.#dynamicOutputs,
      this.#reflective,
      // TODO(aomarks) Fix
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args as any
    );
  }

  invoke(values: InputValues): Promise<OutputValues> {
    const { staticValues, dynamicValues } =
      this.#partitionRuntimeInputValues(values);
    return Promise.resolve(this.#invoke(staticValues, dynamicValues));
  }

  /**
   * Split the values between static and dynamic ports. We do this for type
   * safety, because in TypeScript it is unfortunately not possible to define an
   * object where the values of the unknown keys are of one type, and the known
   * keys are of an incompatible type.
   */
  #partitionRuntimeInputValues(values: InputValues): {
    staticValues: Record<string, JsonSerializable>;
    dynamicValues: Record<string, JsonSerializable>;
  } {
    const staticValues: Record<string, JsonSerializable> = {};
    const dynamicValues: Record<string, JsonSerializable> = {};
    for (const [name, value] of Object.entries(values)) {
      if (this.#staticInputs[name] !== undefined) {
        staticValues[name] = value as JsonSerializable;
      } else {
        dynamicValues[name] = value as JsonSerializable;
      }
    }
    return {
      // TODO(aomarks) Validate schema before passing to invoke function.
      staticValues,
      dynamicValues,
    };
  }

  async describe(values?: InputValues): Promise<NodeDescriberResult> {
    let user: { inputs?: string[]; outputs?: string[] } | undefined = undefined;
    if (this.#describe !== undefined) {
      if (values !== undefined) {
        const { staticValues, dynamicValues } =
          this.#partitionRuntimeInputValues(values);
        user = this.#describe(staticValues, dynamicValues);
      } else {
        user = this.#describe({}, {});
      }
    }

    let inputSchema: JSONSchema4 & {
      properties: { [k: string]: JSONSchema4 };
    };
    if (this.#dynamicInputs === undefined) {
      // All inputs are static.
      inputSchema = portConfigMapToJSONSchema(this.#staticInputs);
    } else if (user?.inputs !== undefined) {
      // The definition author has provided the inputs.
      const d = this.#dynamicInputs;
      inputSchema = portConfigMapToJSONSchema({
        ...Object.fromEntries(user.inputs.map((name) => [name, d])),
        ...this.#staticInputs,
      });
    } else if (values !== undefined) {
      // No definition author inputs, assume all actual inputs are valid.
      const d = this.#dynamicInputs;
      inputSchema = portConfigMapToJSONSchema({
        ...Object.fromEntries(Object.keys(values).map((name) => [name, d])),
        ...this.#staticInputs,
      });
    } else {
      // No definition author inputs or values.
      inputSchema = portConfigMapToJSONSchema(this.#staticInputs);
    }

    let outputSchema: JSONSchema4 & {
      properties: { [k: string]: JSONSchema4 };
    };
    if (this.#dynamicOutputs === undefined) {
      // All outputs are static.
      outputSchema = portConfigMapToJSONSchema(this.#staticOutputs);
    } else if (this.#reflective) {
      // We're reflective, so our outputs are determined by our dynamic inputs.
      const dynamicInputNames = Object.keys(inputSchema.properties).filter(
        (name) => this.#staticInputs[name] === undefined
      );
      const d = this.#dynamicOutputs;
      outputSchema = portConfigMapToJSONSchema({
        ...Object.fromEntries(dynamicInputNames.map((name) => [name, d])),
        ...this.#staticOutputs,
      });
    } else if (user?.outputs !== undefined) {
      // The definition author has provided the outputs.
      const d = this.#dynamicOutputs;
      outputSchema = portConfigMapToJSONSchema({
        ...Object.fromEntries(user.outputs.map((name) => [name, d])),
        ...this.#staticOutputs,
      });
    } else {
      outputSchema = portConfigMapToJSONSchema(this.#staticOutputs);
    }

    return {
      inputSchema: inputSchema as Schema,
      outputSchema: outputSchema as Schema,
    };
  }
}

type LooseInstantiateArgs = object;

type StrictInstantiateArgs<
  SI extends { [K: string]: JsonSerializable },
  DI extends JsonSerializable | undefined,
  A extends LooseInstantiateArgs,
> = {
  [K in keyof SI]:
    | SI[K]
    | OutputPortReference<SI[K]>
    | Input<SI[K]>
    | InputWithDefault<SI[K]>
    | Placeholder<SI[K]>;
} & {
  [K in keyof Omit<A, keyof SI>]: DI extends JsonSerializable
    ? DI | OutputPortReference<DI> | Input<DI> | InputWithDefault<DI>
    : never;
};

type InstanceInputs<
  SI extends { [K: string]: JsonSerializable },
  DI extends JsonSerializable | undefined,
  A extends LooseInstantiateArgs,
> = Expand<SI & { [K in keyof A]: K extends keyof SI ? SI[K] : DI }>;

type InstanceOutputs<
  SI extends { [K: string]: JsonSerializable },
  SO extends { [K: string]: JsonSerializable },
  DO extends JsonSerializable | undefined,
  R extends boolean,
  A extends LooseInstantiateArgs,
> = R extends true
  ? Expand<SO & { [K in Exclude<keyof A, keyof SI>]: DO }>
  : SO;
