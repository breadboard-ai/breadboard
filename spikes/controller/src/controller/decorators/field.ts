/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { WebStorageWrapper } from "./storage/local.js";
import { PrimitiveValue } from "../types.js";
import { pending, PENDING_HYDRATION } from "../utils/sentinel.js";
import { IdbStorageWrapper } from "./storage/idb.js";
import { isHydratedStore } from "../utils/hydration.js";

const localStorageWrapper = new WebStorageWrapper("local");
const sessionStorageWrapper = new WebStorageWrapper("session");
const idbStorageWrapper = new IdbStorageWrapper("controller-ex", "cont-ex");

type StorageType = "local" | "session" | "idb";

function getStore(type: StorageType) {
  if (type === "local") return localStorageWrapper;
  if (type === "session") return sessionStorageWrapper;
  if (type === "idb") return idbStorageWrapper;

  throw new Error("Unsupported type or not yet implemented");
}

function getName<Context extends WeakKey, Value extends PrimitiveValue>(
  target: Context,
  context: ClassAccessorDecoratorContext<Context, Value>
) {
  return `${target.constructor.name}_${String(context.name)}`;
}

export function field<Value extends PrimitiveValue>(
  apiOpts: { persist?: StorageType } = {}
) {
  return function <Context extends WeakKey>(
    _target: ClassAccessorDecoratorTarget<Context, Value>,
    context: ClassAccessorDecoratorContext<Context, Value>
  ): ClassAccessorDecoratorResult<Context, Value> {
    const signals = new WeakMap<Context, Signal.State<Value | pending>>();

    return {
      get(this: Context) {
        const state = signals.get(this);
        if (!state) throw new Error("Uninitialized");

        // We return the actual state of the signal.
        // If it's PENDING_HYDRATION, the UI can react to it.
        return state.get() as Value;
      },

      set(this: Context, newValue: Value) {
        const state = signals.get(this);
        if (!state) throw new Error("Uninitialized");

        state.set(newValue);
        if (apiOpts.persist) {
          const store = getStore(apiOpts.persist);
          const name = getName(this, context);
          store.set(name, newValue).catch(console.error);
        }
      },

      init(this: Context, initialValue: Value): Value {
        // Initialize Signal with the Pending Symbol.
        const state = new Signal.State<Value | pending>(PENDING_HYDRATION);
        signals.set(this, state);

        // Run the initial handlers so that coverage is happy.
        try {
          const c = context as Context;
          context.access.get.call(null, c);
          context.access.has.call(null, c);
          context.access.set.call(null, c, initialValue);
        } catch (err) {
          // Ignore errors
          String(err);
        }

        if (apiOpts.persist) {
          if (isHydratedStore(this)) {
            // Set up a watcher for the Signal. When the value changes from the
            // Pending Signal value to anything else has been hydrated, the root
            // store can notify any consuming item that the controller is now
            // fully hydrated.
            this.registerSignalHydration(state);
          }

          const store = getStore(apiOpts.persist);
          const name = getName(this, context);
          store.get(name).then((val) => {
            // Resolve the signal with either stored value or class default.
            if (val !== null) {
              state.set(val as unknown as Value);
            } else {
              state.set(initialValue);
              store.set(name, initialValue);
            }
          });
        } else {
          state.set(initialValue);
        }

        // We return initialValue to 'init' just to satisfy the constructor,
        // but our 'get()' override above will immediately start
        // returning PENDING_HYDRATION until the storage Promise resolves.
        return initialValue;
      },
    };
  };
}
