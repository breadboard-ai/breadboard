/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberContext,
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
import { toJSONSchema, type JsonSerializable } from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  PortConfig,
  PortConfigs,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";
import type { DynamicInputPorts, LooseDescribeFn } from "./define.js";
import { Instance } from "./instance.js";
import { portConfigMapToJSONSchema } from "./json-schema.js";

export interface Definition<
  /* Static Inputs   */ SI extends { [K: string]: JsonSerializable },
  /* Static Outputs  */ SO extends { [K: string]: JsonSerializable },
  /* Dynamic Inputs  */ DI extends JsonSerializable | undefined,
  /* Dynamic Outputs */ DO extends JsonSerializable | undefined,
  /* Optional Inputs */ OI extends keyof SI,
  /* Reflective?     */ R extends boolean,
  /* Primary Input   */ PI extends keyof SI | undefined,
  /* Primary Output  */ PO extends keyof SO | undefined,
> extends StrictNodeHandler {
  <A extends LooseInstantiateArgs>(
    args: A & StrictInstantiateArgs<SI, OI, DI, A>
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
  /* Optional Inputs */ OI extends keyof SI,
  /* Reflective?     */ R extends boolean,
  /* Primary Input   */ PI extends keyof SI | undefined,
  /* Primary Output  */ PO extends keyof SO | undefined,
> implements StrictNodeHandler
{
  readonly #name: string;
  readonly #staticInputs: Record<string, StaticInputPortConfig>;
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
  readonly #describe?: LooseDescribeFn;

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
    describe?: LooseDescribeFn
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
    args: A & StrictInstantiateArgs<SI, OI, DI, A>
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
      this.#applyDefaultsAndPartitionRuntimeInputValues(values);
    return Promise.resolve(this.#invoke(staticValues, dynamicValues));
  }

  /**
   * Apply defaults, and split the values between static and dynamic ports.
   *
   * We split inputs values for type safety, because in TypeScript it is
   * unfortunately not possible to define an object where the values of the
   * unknown keys are of one type, and the known keys are of an incompatible
   * type.
   */
  #applyDefaultsAndPartitionRuntimeInputValues(values: InputValues): {
    staticValues: Record<string, JsonSerializable>;
    dynamicValues: Record<string, JsonSerializable>;
  } {
    const staticValues: Record<string, JsonSerializable> = {};
    const dynamicValues: Record<string, JsonSerializable> = {};
    for (const [name, config] of Object.entries(this.#staticInputs)) {
      if (config.default !== undefined) {
        staticValues[name] = config.default;
      }
    }
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

  async describe(
    values?: InputValues,
    inboundEdges?: Schema,
    _outboundEdges?: Schema,
    context?: NodeDescriberContext
  ): Promise<NodeDescriberResult> {
    let user:
      | { inputs?: DynamicInputPorts; outputs?: DynamicInputPorts }
      | undefined = undefined;
    if (this.#describe !== undefined) {
      if (values !== undefined) {
        const { staticValues, dynamicValues } =
          this.#applyDefaultsAndPartitionRuntimeInputValues(values);
        user = await this.#describe(staticValues, dynamicValues, context);
      } else {
        user = await this.#describe({}, {}, context);
      }
    }

    let inputSchema: JSONSchema4 & {
      properties?: { [k: string]: JSONSchema4 };
    };
    if (this.#dynamicInputs === undefined) {
      // All inputs are static.
      inputSchema = {
        ...portConfigMapToJSONSchema(this.#staticInputs, []),
        additionalProperties: false,
      };
    } else if (user?.inputs !== undefined) {
      // The definition author has provided the inputs.
      const { newStatic, newDynamic } = parseDynamicPorts(
        user.inputs,
        this.#dynamicInputs
      );
      inputSchema = portConfigMapToJSONSchema(
        { ...newStatic, ...this.#staticInputs },
        // TODO(aomarks) The user should be able to indicate from their describe
        // function whether a specific input is optional/required.
        []
      );
      if (newDynamic === undefined) {
        inputSchema.additionalProperties = false;
      } else if (newDynamic.type === "unknown") {
        inputSchema.additionalProperties = true;
      } else {
        inputSchema.additionalProperties = toJSONSchema(newDynamic.type);
      }
    } else {
      // No definition author inputs, assume all actual inputs are valid.
      const actualInputNames = [
        ...new Set([
          ...Object.keys(values ?? {}),
          ...Object.keys(inboundEdges?.properties ?? {}),
        ]),
      ].sort();
      const actualDynamicInputNames = actualInputNames.filter(
        // Only include the actual input names that aren't in our static inputs.
        (name) => this.#staticInputs[name] === undefined
      );
      const dynamicInputConfig = this.#dynamicInputs;
      inputSchema = {
        ...portConfigMapToJSONSchema(
          {
            ...Object.fromEntries(
              actualInputNames.map((name) => [name, dynamicInputConfig])
            ),
            ...this.#staticInputs,
          },
          actualDynamicInputNames
        ),
        additionalProperties:
          this.#dynamicInputs.type === "unknown"
            ? true
            : toJSONSchema(this.#dynamicInputs.type),
      };
    }

    let outputSchema: JSONSchema4 & {
      properties?: { [k: string]: JSONSchema4 };
    };
    if (this.#dynamicOutputs === undefined) {
      // All outputs are static.
      outputSchema = {
        ...portConfigMapToJSONSchema(
          this.#staticOutputs,
          // TODO(aomarks) The Breadboard visual editor interprets JSON schema
          // "required" on an output as "the user must wire this to something"
          // (shows up as a red port). That might be not quite right, it seems
          // like "required" here should describe the expectations of the node
          // implementation's return object, not the way the user choses to use
          // the output.
          true
        ),
        additionalProperties: false,
      };
    } else if (this.#reflective) {
      // We're reflective, so our outputs are determined by our dynamic inputs.
      const dynamicInputNames = Object.keys(
        inputSchema.properties ?? {}
      ).filter((name) => this.#staticInputs[name] === undefined);
      const d = this.#dynamicOutputs;
      outputSchema = {
        ...portConfigMapToJSONSchema(
          {
            ...Object.fromEntries(dynamicInputNames.map((name) => [name, d])),
            ...this.#staticOutputs,
          },
          true
        ),
        additionalProperties: false,
      };
    } else if (user?.outputs !== undefined) {
      // The definition author has provided the outputs.
      const { newStatic, newDynamic } = parseDynamicPorts(
        user.outputs,
        this.#dynamicOutputs
      );
      outputSchema = portConfigMapToJSONSchema(
        {
          ...newStatic,
          ...this.#staticOutputs,
        },
        true
      );
      if (newDynamic === undefined) {
        outputSchema.additionalProperties = false;
      } else if (newDynamic.type === "unknown") {
        outputSchema.additionalProperties = true;
      } else {
        outputSchema.additionalProperties = toJSONSchema(newDynamic.type);
      }
    } else {
      outputSchema = {
        ...portConfigMapToJSONSchema(this.#staticOutputs, true),
        additionalProperties: toJSONSchema(this.#dynamicOutputs.type),
      };
    }

    return {
      inputSchema: inputSchema as Schema,
      outputSchema: outputSchema as Schema,
    };
  }
}

function parseDynamicPorts(
  ports: DynamicInputPorts,
  base: DynamicInputPortConfig | DynamicOutputPortConfig
): {
  newStatic: Record<string, StaticInputPortConfig | StaticOutputPortConfig>;
  newDynamic: DynamicInputPortConfig | DynamicOutputPortConfig | undefined;
} {
  ports = Array.isArray(ports)
    ? Object.fromEntries(ports.map((name) => [name, {}]))
    : ports;
  const newStatic = Object.fromEntries(
    Object.entries(ports)
      .filter(
        /** See {@link DynamicInputPorts} for why undefined is possible here. */
        ([name, config]) => config !== undefined && name !== "*"
      )
      .map(([name, config]) => [name, { ...base, ...config }])
  );
  const newDynamic =
    ports["*"] !== undefined ? { ...base, ...ports["*"] } : undefined;
  return { newStatic, newDynamic };
}

type LooseInstantiateArgs = object;

type StrictInstantiateArgs<
  SI extends { [K: string]: JsonSerializable },
  OI extends keyof SI,
  DI extends JsonSerializable | undefined,
  A extends LooseInstantiateArgs,
> = { [K in keyof Omit<SI, OI>]: InstantiateArg<SI[K]> } & {
  [K in OI]?: InstantiateArg<SI[K]> | undefined;
} & {
  [K in keyof Omit<A, keyof SI>]: DI extends JsonSerializable
    ? InstantiateArg<DI>
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

type InstantiateArg<T extends JsonSerializable> =
  | T
  | OutputPortReference<T>
  | Input<T>
  | InputWithDefault<T>
  | Placeholder<T>;
