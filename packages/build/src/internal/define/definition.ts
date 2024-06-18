/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";
import type { JSONSchema4 } from "json-schema";
import type { Input, InputWithDefault } from "../board/input.js";
import type { Loopback } from "../board/loopback.js";
import type { StrictNodeHandler } from "../common/compatibility.js";
import type { OutputPortReference } from "../common/port.js";
import type { Expand } from "../common/type-util.js";
import {
  toJSONSchema,
  type BreadboardType,
  type JsonSerializable,
} from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  PortConfig,
  PortConfigs,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";
import type {
  CustomDescribePortManifest,
  VeryLooseInvokeFn,
} from "./define.js";
import type { LooseDescribeFn } from "./describe.js";
import { Instance } from "./instance.js";
import {
  jsonSchemaToPortConfigMap,
  portConfigMapToJSONSchema,
} from "./json-schema.js";
import {
  isUnsafeSchema,
  unsafeSchemaAccessor,
  type UnsafeSchema,
} from "./unsafe-schema.js";
import { unsafeType } from "../type-system/unsafe.js";
import { array } from "../type-system/array.js";
import { object } from "../type-system/object.js";
import { normalizeBreadboardError } from "../common/error.js";
import type { Convergence } from "../board/converge.js";
import type { BoardDefinition } from "../board/board.js";

export interface Definition<
  /* Static Inputs   */ SI extends { [K: string]: JsonSerializable },
  /* Static Outputs  */ SO extends { [K: string]: JsonSerializable },
  /* Dynamic Inputs  */ DI extends JsonSerializable | undefined,
  /* Dynamic Outputs */ DO extends JsonSerializable | undefined,
  /* Optional Inputs */ OI extends keyof SI,
  /* Reflective?     */ R extends boolean,
  /* Primary Input   */ PI extends string | false,
  /* Primary Output  */ PO extends string | false,
  /* Input Metadata  */ IM extends { [K: string]: InputMetadata },
> extends StrictNodeHandler {
  <A extends LooseInstantiateArgs>(
    args: A & StrictInstantiateArgs<SI, OI, DI, A, IM>
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
  /* Primary Input   */ PI extends string | false,
  /* Primary Output  */ PO extends string | false,
  /* Input Metadata  */ IM extends { [K: string]: InputMetadata },
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
  readonly #invoke: VeryLooseInvokeFn;
  readonly #describe?: LooseDescribeFn;

  constructor(
    name: string,
    staticInputs: PortConfigs,
    staticOutputs: PortConfigs,
    dynamicInputs: PortConfig | undefined,
    dynamicOutputs: DynamicOutputPortConfig | undefined,
    primaryInput: string | undefined,
    primaryOutput: string | undefined,
    invoke: VeryLooseInvokeFn,
    describe?: LooseDescribeFn
  ) {
    if ("$id" in staticInputs) {
      throw new Error(
        '"$id" cannot be used as an input port name because it is reserved'
      );
    }
    if ("$metadata" in staticInputs) {
      throw new Error(
        '"$metadata" cannot be used as an input port name because it is reserved'
      );
    }
    if ("$error" in staticOutputs) {
      throw new Error(
        '"$error" cannot be used as an output port name because it is reserved'
      );
    }
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
    args: A & StrictInstantiateArgs<SI, OI, DI, A, IM>
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

  async invoke(
    values: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> {
    const { staticValues, dynamicValues } =
      this.#applyDefaultsAndPartitionRuntimeInputValues(values);
    let result;
    try {
      result = await this.#invoke(staticValues, dynamicValues, context);
    } catch (e) {
      return {
        $error: {
          message: `Internal Exception: ${String(e instanceof Error ? e.stack : e).replace(/^Error:\s*/, "")}
}`,
        },
      };
    }
    if (result.$error !== undefined) {
      result.$error = normalizeBreadboardError(result.$error);
    }
    return result;
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
    outboundEdges?: Schema,
    context?: NodeDescriberContext
  ): Promise<NodeDescriberResult> {
    let user:
      | {
          inputs?: CustomDescribePortManifest;
          outputs?: CustomDescribePortManifest;
        }
      | undefined = undefined;
    if (this.#describe !== undefined) {
      const { staticValues, dynamicValues } =
        this.#applyDefaultsAndPartitionRuntimeInputValues(values ?? {});
      user = await this.#describe(staticValues, dynamicValues, {
        ...(context ?? { outerGraph: { nodes: [], edges: [] } }),
        inputSchema: jsonSchemaToPortConfigMap(
          (inboundEdges as JSONSchema4) ?? {}
        ),
        outputSchema: jsonSchemaToPortConfigMap(
          (outboundEdges as JSONSchema4) ?? {}
        ),
      });
    }

    let inputSchema: JSONSchema4 & {
      properties?: { [k: string]: JSONSchema4 };
    };
    if (isUnsafeSchema(user?.inputs)) {
      inputSchema = mergeStaticsAndUnsafeUserSchema(
        portConfigMapToJSONSchema(this.#staticInputs, []),
        user.inputs[unsafeSchemaAccessor]
      );
    } else if (this.#dynamicInputs === undefined) {
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
      const getInputType = (name: string): BreadboardType => {
        const fromInbound = inboundEdges?.properties?.[name];
        if (fromInbound) {
          return unsafeType(fromInbound as JSONSchema4);
        }
        const fromValues = values?.[name];
        if (fromValues !== undefined) {
          return inferType(fromValues);
        }
        return dynamicInputConfig.type;
      };
      inputSchema = {
        ...portConfigMapToJSONSchema(
          {
            ...Object.fromEntries(
              actualInputNames.map((name) => [
                name,
                { type: getInputType(name) },
              ])
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
    if (isUnsafeSchema(user?.outputs)) {
      outputSchema = mergeStaticsAndUnsafeUserSchema(
        portConfigMapToJSONSchema(this.#staticOutputs, true),
        user.outputs[unsafeSchemaAccessor]
      );
    } else if (this.#dynamicOutputs === undefined) {
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
      const dynamicInputs = Object.entries(inputSchema.properties ?? {}).filter(
        ([name]) => this.#staticInputs[name] === undefined
      );
      outputSchema = {
        ...portConfigMapToJSONSchema(
          {
            ...Object.fromEntries(
              dynamicInputs.map(([name, schema]) => [
                name,
                { type: unsafeType(schema) },
              ])
            ),
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

/**
 * Extra data about inputs. This is here to stop growing the number of
 * parameters on Definition.
 */
export type InputMetadata = {
  board: boolean;
};

function parseDynamicPorts(
  ports: Exclude<CustomDescribePortManifest, UnsafeSchema>,
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
        /** See {@link CustomDescribePortManifest} for why undefined is possible here. */
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
  IM extends { [K: string]: InputMetadata },
> = {
  $id?: string;
  $metadata?: {
    title?: string;
    description?: string;
  };
} & {
  [K in keyof Omit<SI, OI | "$id" | "$metadata">]: IM[K extends keyof IM
    ? K
    : never]["board"] extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      InstantiateArg<SI[K]> | BoardDefinition<any, any>
    : InstantiateArg<SI[K]>;
} & {
  [K in OI]?:
    | InstantiateArg<SI[K]>
    | OutputPortReference<SI[K] | undefined>
    | undefined;
} & {
  [K in keyof Omit<
    A,
    keyof SI | "$id" | "$metadata"
  >]: DI extends JsonSerializable ? InstantiateArg<DI> : never;
};

type InstanceInputs<
  SI extends { [K: string]: JsonSerializable },
  DI extends JsonSerializable | undefined,
  A extends LooseInstantiateArgs,
> = Expand<
  SI & {
    [K in keyof Omit<A, "$id" | "$metadata">]: K extends keyof SI ? SI[K] : DI;
  }
>;

type InstanceOutputs<
  SI extends { [K: string]: JsonSerializable },
  SO extends { [K: string]: JsonSerializable },
  DO extends JsonSerializable | undefined,
  R extends boolean,
  A extends LooseInstantiateArgs,
> = R extends true
  ? Expand<SO & { [K in Exclude<keyof A, keyof SI | "$id" | "$metadata">]: DO }>
  : SO;

type InstantiateArg<T extends JsonSerializable> =
  | T
  | OutputPortReference<T>
  | Input<T>
  | InputWithDefault<T>
  | Loopback<T>
  | Convergence<T>;

function mergeStaticsAndUnsafeUserSchema(
  statics: JSONSchema4,
  unsafe: JSONSchema4
): JSONSchema4 {
  const merged = { ...statics, ...unsafe };
  if (statics.properties || unsafe.properties) {
    merged.properties = { ...statics.properties, ...unsafe.properties };
  }
  // The JSON Schema types say that required can be boolean, but there is
  // no evidence for that in the JSON Schema documentation.
  const aRequired = statics.required as Exclude<
    JSONSchema4["required"],
    boolean
  >;
  const bRequired = unsafe.required as Exclude<
    JSONSchema4["required"],
    boolean
  >;
  if (aRequired || bRequired) {
    merged.required = [
      ...new Set([...(aRequired ?? []), ...(bRequired ?? [])]),
    ];
  }
  return merged;
}

function inferType(value: unknown): BreadboardType {
  const t = typeof value;
  switch (t) {
    case "string":
    case "number":
    case "boolean": {
      return t;
    }
    case "object": {
      if (value === null) {
        return "null";
      }
      if (Array.isArray(value)) {
        return array("unknown");
      }
      return object({}, "unknown");
    }
  }
  return "unknown";
}
