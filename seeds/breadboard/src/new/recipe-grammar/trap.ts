/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, OutputValues, AbstractNode } from "../runner/types.js";

/**
 * During serialization, these will be returned on `await` on a node. If the
 * code accesses a field, it will throw an `AwaitWhileSerializing`.
 *
 * That way when an awaited async handler function returns a node, and it will
 * be returned as TrapResult, which we remember in the scope.
 *
 * But if the function itself awaits a node and reads the results, it will throw
 * an exception.
 *
 * If the function itself awaits a node and for some reason doesn't do anything
 * with it (otherwise it would trigger the exception), and returns a different
 * value or node, we'll detect that by seeing that TrapResult was set, but was
 * not returned. Such a handler function should be serialized.
 *
 * If the function doesn't return either a value or a node, i.e. just a constant
 * value, we'll for now assume that it's a non-deterministic function whose
 * output doesn't depend on the inputs and serialize it (a node that returns
 * pure values but does read from the inputs would trigger the condition above).
 *
 * TODO: Eventually though, that last case should throw an error, as all
 * external calls should be explicit (e.g. using a fetch node).
 */
const trapResultSymbol = Symbol("TrapResult");

export class TrapResult<I extends InputValues, O extends OutputValues> {
  [trapResultSymbol]: AbstractNode<I, O>;

  constructor(public node: AbstractNode<I, O>) {
    this[trapResultSymbol] = node;
    return new Proxy(this, {
      get: (target, prop) => {
        // `then` because await checks whether this is a thenable (it should
        // fail). NOTE: Code that uses as an output wire called `await` will now
        // not trigger the trap. That's why there is a then symbol: Increasing
        // the chances that we get some weird error anyway. TODO: Improve.
        if (typeof prop === "symbol" || prop === "then")
          return Reflect.get(target, prop);
        throw new TrappedDataReadWhileSerializing();
      },
    });
  }

  then = Symbol("then");

  // Use this instead of `instanceof`.
  static isTrapResult<I extends InputValues, O extends OutputValues>(
    trapResult: TrapResult<I, O>
  ) {
    return trapResult[trapResultSymbol] !== undefined;
  }

  // This is used to get the underlying node despite the proxy above.
  static getNode<I extends InputValues, O extends OutputValues>(
    trapResult: TrapResult<I, O>
  ) {
    return trapResult[trapResultSymbol];
  }
}

export class TrappedDataReadWhileSerializing {}
