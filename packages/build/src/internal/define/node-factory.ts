/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NewNodeFactory, NewNodeValue } from "@google-labs/breadboard";
import type { Definition } from "./definition.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Expand } from "../common/type-util.js";

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `NodeFactoryFromDefinition` takes a {@link NodeDefinition} type (as returned
 * by {@link defineNodeType}) and produces a {@link NodeFactory} type suitable
 * for use with {@link KitBuilder}.
 */
export type NodeFactoryFromDefinition<
  D extends Definition<any, any, any, any, any, any, any, any, any>,
> =
  D extends Definition<
    infer SI,
    infer SO,
    infer DI,
    infer DO,
    infer OI,
    any,
    any,
    any,
    any
  >
    ? NewNodeFactory<
        Expand<
          Omit<SI, OI> & { [K in OI]?: SI[K] } & (DI extends JsonSerializable
              ? { [K: string]: NewNodeValue }
              : {})
        >,
        Expand<
          SO &
            (DO extends JsonSerializable ? { [K: string]: NewNodeValue } : {})
        >
      >
    : never;
