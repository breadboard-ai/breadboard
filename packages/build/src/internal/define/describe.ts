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
  StaticOutputPortConfig,
} from "./config.js";
import type {
  CustomDescribePortManifest,
  DynamicInvokeParams,
} from "./define.js";

/**
 * The same as {@link NodeDescriberContext} but with `inputSchema ` and
 * `outputSchema` added in, to simplify the signature of `describe`.
 *
 * TODO(aomarks) Roll this into {@link NodeDescriberContext}.
 */
export interface NodeDescriberContextWithSchemas extends NodeDescriberContext {
  inputSchema: { [k: string]: StaticInputPortConfig };
  outputSchema: { [k: string]: StaticOutputPortConfig };
}

export type LooseDescribeFn = (
  staticParams: Record<string, JsonSerializable>,
  dynamicParams: Record<string, JsonSerializable>,
  context?: NodeDescriberContextWithSchemas
) => MaybePromise<{
  inputs?: CustomDescribePortManifest;
  outputs?: CustomDescribePortManifest;
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
            context?: NodeDescriberContextWithSchemas
          ) => MaybePromise<{
            inputs: CustomDescribePortManifest;
            outputs?: never;
          }>;
        }
      : {
          // poly/poly non-reflective
          describe: (
            staticInputs: Expand<StaticDescribeValues<I>>,
            dynamicInputs: Expand<DynamicInvokeParams<I>>,
            context?: NodeDescriberContextWithSchemas
          ) => MaybePromise<{
            inputs?: CustomDescribePortManifest;
            outputs: CustomDescribePortManifest;
          }>;
        }
    : {
        // poly/mono
        describe?: (
          staticInputs: Expand<StaticDescribeValues<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>,
          context?: NodeDescriberContextWithSchemas
        ) => MaybePromise<{
          inputs: CustomDescribePortManifest;
          outputs?: never;
        }>;
      }
  : O["*"] extends DynamicOutputPortConfig
    ? {
        // mono/poly
        describe: (
          staticInputs: Expand<StaticDescribeValues<I>>,
          dynamicInputs: Expand<DynamicInvokeParams<I>>,
          context?: NodeDescriberContextWithSchemas
        ) => MaybePromise<{
          inputs?: never;
          outputs: CustomDescribePortManifest;
        }>;
      }
    : {
        // mono/mono
        describe?: never;
      };
