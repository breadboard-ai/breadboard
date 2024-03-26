/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NewNodeFactory } from "@google-labs/breadboard";
import type { MonomorphicDefinition } from "./definition-monomorphic.js";
import type { PolymorphicDefinition } from "./definition-polymorphic.js";
import type { ConvertBreadboardType } from "../type-system/type.js";

/**
 * `NodeFactoryFromDefinition` takes a {@link NodeDefinition} type (as returned
 * by {@link defineNodeType}) and produces a {@link NodeFactory} type suitable
 * for use with {@link KitBuilder}.
 */
export type NodeFactoryFromDefinition<
  // TODO(aomarks) We should use PolymorphicDefinition<PortConfigMap,
  // PortConfigMap> here instead of <any, any>, but for a currently unknown
  // reason that won't match some definitions.
  //
  DEF extends // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MonomorphicDefinition<any, any> | PolymorphicDefinition<any, any, any>,
> =
  DEF extends MonomorphicDefinition<infer ISHAPE, infer OSHAPE>
    ? NewNodeFactory<
        {
          [PORT in keyof ISHAPE]: ConvertBreadboardType<ISHAPE[PORT]["type"]>;
        },
        {
          [PORT in keyof OSHAPE]: ConvertBreadboardType<OSHAPE[PORT]["type"]>;
        }
      >
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      DEF extends PolymorphicDefinition<infer ISHAPE, any, infer OSHAPE>
      ? NewNodeFactory<
          {
            [PORT in keyof Omit<ISHAPE, "*">]: ConvertBreadboardType<
              ISHAPE[PORT]["type"]
            >;
          } & Record<string, unknown>,
          {
            [PORT in keyof Omit<OSHAPE, "*">]: ConvertBreadboardType<
              OSHAPE[PORT]["type"]
            >;
          } & Record<string, unknown>
        >
      : never;
