/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphMetadata } from "@google-labs/breadboard";
import { BuilderScopeInterface, BuilderNodeInterface } from "./types.js";
import { AbstractNode, ScopeConfig } from "../runner/types.js";

import { Scope } from "../runner/scope.js";
import { swapCurrentContextScope } from "./default-scope.js";

/**
 * Adds syntactic sugar to support unproxying and serialization of nodes/graphs.
 */
export class BuilderScope extends Scope implements BuilderScopeInterface {
  #isSerializing: boolean;

  // TODO:BASE, config of subclasses can have more fields
  constructor(
    config: ScopeConfig & {
      serialize?: boolean;
    } = {}
  ) {
    super(config);
    this.#isSerializing = config.serialize ?? false;
  }

  async serialize(
    metadata?: GraphMetadata,
    node?: AbstractNode
  ): Promise<GraphDescriptor> {
    return super.serialize(
      metadata,
      node && typeof (node as BuilderNodeInterface).unProxy === "function"
        ? (node as BuilderNodeInterface).unProxy()
        : node
    );
  }

  serializing() {
    return this.#isSerializing;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asScopeFor<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: unknown[]) => {
      const oldScope = swapCurrentContextScope(this);
      try {
        return fn(...args);
      } finally {
        swapCurrentContextScope(oldScope);
      }
    }) as T;
  }
}
