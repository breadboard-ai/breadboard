/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NewNodeFactory } from "@google-labs/breadboard";
import type { Definition } from "./definition.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Expand } from "../common/type-util.js";

/**
 * `NodeFactoryFromDefinition` takes a {@link NodeDefinition} type (as returned
 * by {@link defineNodeType}) and produces a {@link NodeFactory} type suitable
 * for use with {@link KitBuilder}.
 */
export type NodeFactoryFromDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  D extends Definition<any, any, any, any, any, any, any>,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  D extends Definition<infer SI, infer SO, infer DI, infer DO, any, any, any>
    ? NewNodeFactory<
        Expand<
          SI & (DI extends JsonSerializable ? { [K: string]: DI } : object)
        >,
        Expand<
          SO & (DO extends JsonSerializable ? { [K: string]: DO } : object)
        >
      >
    : never;
