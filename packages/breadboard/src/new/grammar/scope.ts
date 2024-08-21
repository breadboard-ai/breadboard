/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BuilderScopeInterface,
  BuilderNodeInterface,
  ClosureEdge,
  GraphCombinedMetadata,
} from "./types.js";
import { AbstractNode, ScopeConfig } from "../runner/types.js";

import { Scope } from "../runner/scope.js";
import { BuilderNode } from "./node.js";
import { GraphDescriptor } from "../../types.js";

/**
 * Adds syntactic sugar to support unproxying and serialization of nodes/graphs.
 */
export class BuilderScope extends Scope implements BuilderScopeInterface {
  #isSerializing: boolean;
  #closureEdges: ClosureEdge[] = [];

  parentLambdaNode?: BuilderNode;

  // TODO:BASE, config of subclasses can have more fields
  constructor(
    config: ScopeConfig & {
      serialize?: boolean;
      parentLambda?: BuilderNode;
    } = {}
  ) {
    super(config);
    this.#isSerializing = config.serialize ?? false;
    this.parentLambdaNode = config.parentLambda;
  }

  async serialize(
    metadata?: GraphCombinedMetadata,
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

  addClosureEdge(edge: ClosureEdge) {
    this.#closureEdges.push(edge);
  }

  getClosureEdges() {
    return this.#closureEdges;
  }
}

/**
 * The following is inspired by zone.js, but much simpler, and crucially doesn't
 * require monkey patching.
 *
 * Instead, we use a global variable to store the current scope, and swap it
 * out when we need to run a function in a different context.
 *
 * Scope.asScopeFor() wraps a function that runs with that Scope as context.
 *
 * action and any nodeFactory will run with the current Scope as context. That
 * is, they remember the Scope that was active when they were created.
 *
 * Crucially (and that's all we need from zone.js), {NodeImpl,Value}.then() call
 * onsuccessful and onrejected with the Scope as context. So even if the
 * context changed in the meantime, due to async calls, the rest of a flow
 * defining function will run with the current Scope as context.
 *
 * This works because NodeImpl and Value are PromiseLike, and so their then() is
 * called when they are awaited. Importantly, there is no context switch between
 * then() and the onsuccessful or onrejected call, if called from a Promise
 * then(), including a Promise.resolve().then (This makes it robust in case the
 * containing function isn't immediately awaited and so possibly Promises are
 * being scheduled). However, there is a context switch between the await and
 * the then() call, and so the context might have changed. That's why we
 * remember the scope on the node object.
 *
 * One requirement from this that there can't be any await in the body of a flow
 * or action function, if they are followed by either node creation or flow
 * calls. This is also a requirement for restoring state after interrupting a
 * flow.
 */

let currentContextScope: BuilderScope | undefined = undefined;

export function getCurrentContextScope() {
  // Initialize on first use.
  if (!currentContextScope) currentContextScope = new BuilderScope();

  return currentContextScope;
}

export function swapCurrentContextScope(scope: BuilderScope) {
  const oldScope = getCurrentContextScope();
  currentContextScope = scope;
  return oldScope;
}
