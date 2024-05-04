/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriberContext } from "@google-labs/breadboard";
import type { Expand, MaybePromise } from "../common/type-util.js";
import type {
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  InputPortConfig,
  OutputPortConfig,
  PortConfig,
  StaticInputPortConfig,
} from "./config.js";
import type { DynamicInputPorts, DynamicInvokeParams } from "./define.js";

export type LooseDescribeFn = (
  staticParams: Record<string, JsonSerializable>,
  dynamicParams: Record<string, JsonSerializable>,
  context?: NodeDescriberContext
) => MaybePromise<{
  inputs?: DynamicInputPorts;
  outputs?: DynamicInputPorts;
}>;

export type StaticDescribeValues<I extends Record<string, InputPortConfig>> = {
  [K in keyof Omit<I, "*">]: I[K] extends StaticInputPortConfig
    ? I[K]["default"] extends JsonSerializable
      ? Convert<I[K]>
      : Convert<I[K]> | undefined
    : Convert<I[K]>;
};

type Convert<C extends PortConfig> = ConvertBreadboardType<C["type"]>;

export type StrictDescribeFn<
  I extends Record<string, InputPortConfig>,
  O extends Record<string, OutputPortConfig>,
> = I["*"] extends DynamicInputPortConfig
  ? O["*"] extends DynamicOutputPortConfig
    ? O["*"]["reflective"] extends true
      ? {
          // poly/poly reflective
          describe?: (
            staticInputs: Expand<StaticDescribeValues<I>>,
            dynamicInputs: Expand<DynamicInvokeParams<I>>,
            context?: NodeDescriberContext
          ) => MaybePromise<{
            inputs: DynamicInputPorts;
            outputs?: never;
          }>;
        }
      : {
          // poly/poly non-reflective
          describe: (
            staticInputs: Expand<StaticDescribeValues<I>>,
            dynamicInputs: Expand<DynamicInvokeParams<I>>,
            context?: NodeDescriberContext
          ) => MaybePromise<{
            inputs?: DynamicInputPorts;
            outputs: DynamicInputPorts;
          }>;
        }
    : {
        // poly/mono
        describe?: (
          staticInputs: Expand<StaticDescribeValues<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>,
          context?: NodeDescriberContext
        ) => MaybePromise<{
          inputs: DynamicInputPorts;
          outputs?: never;
        }>;
      }
  : O["*"] extends DynamicOutputPortConfig
    ? {
        // mono/poly
        describe: (
          staticInputs: Expand<StaticDescribeValues<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>,
          context?: NodeDescriberContext
        ) => MaybePromise<{
          inputs?: never;
          outputs: DynamicInputPorts;
        }>;
      }
    : {
        // mono/mono
        describe?: never;
      };
