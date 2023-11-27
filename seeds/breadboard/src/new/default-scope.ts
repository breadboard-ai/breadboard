/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  OutputValues,
  NodeHandler,
  NodeFactory,
  InputsMaybeAsValues,
} from "./types.js";

import { Scope } from "./scope.js";
import { NodeImpl } from "./node.js";

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

// Initialize with a default global Scope.
let currentContextScope = new Scope();

export function getCurrentContextScope() {
  const scope = currentContextScope;
  if (!scope) throw Error("No scope found in context");
  return scope;
}

export function swapCurrentContextScope(scope: Scope) {
  const oldScope = currentContextScope;
  currentContextScope = scope;
  return oldScope;
}

// TODO:BASE: This does two things
//   (1) register a handler with the scope
//   (2) create a factory function for the node type
// BASE should only be the first part, the second part should be in the syntax
export function addNodeType<I extends InputValues, O extends OutputValues>(
  name: string | undefined,
  handler: NodeHandler<I, O>
): NodeFactory<I, O> {
  if (name)
    getCurrentContextScope().addHandlers({
      [name]: handler as unknown as NodeHandler,
    });
  return ((config?: InputsMaybeAsValues<I>) => {
    return new NodeImpl(
      name ?? handler,
      getCurrentContextScope(),
      config
    ).asProxy();
  }) as unknown as NodeFactory<I, O>;
}
