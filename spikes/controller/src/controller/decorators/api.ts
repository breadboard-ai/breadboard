/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "@lit-labs/signals";
import { WebStorageWrapper } from "./storage/local.js";
import { PrimitiveType } from "../types.js";
import { PENDING_HYDRATION } from "../utils/sentinel.js";
import { IdbStorageWrapper } from "./storage/idb.js";

const localStorageWrapper = new WebStorageWrapper("local");
const sessionStorageWrapper = new WebStorageWrapper("session");
const idbStorageWrapper = new IdbStorageWrapper("controller-ex", "cont-ex");

type PrimitiveValue = PrimitiveType | null | typeof PENDING_HYDRATION;
type StorageType = "local" | "session" | "idb";

function getStore(type: StorageType) {
  if (type === "local") return localStorageWrapper;
  if (type === "session") return sessionStorageWrapper;
  if (type === "idb") return idbStorageWrapper;

  throw new Error("Unsupported type or not yet implemented");
}

function getPersistenceName<
  Context extends WeakKey,
  Value extends PrimitiveValue
>(target: Context, context: ClassAccessorDecoratorContext<Context, Value>) {
  return `${target.constructor.name}_${String(context.name)}`;
}

export function api(apiOpts: { persist?: StorageType } = {}) {
  return function <Context extends WeakKey, Value extends PrimitiveValue>(
    _target: ClassAccessorDecoratorTarget<Context, Value>,
    context: ClassAccessorDecoratorContext<Context, Value>
  ): ClassAccessorDecoratorResult<Context, Value> {
    const signals = new WeakMap<
      Context,
      Signal.State<Value | typeof PENDING_HYDRATION>
    >();

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
          const name = getPersistenceName(this, context);
          store.set(name, newValue).catch(console.error);
        }
      },

      init(this: Context, initialValue: Value): Value {
        // Initialize Signal with the Pending Symbol.
        const state = new Signal.State<Value | typeof PENDING_HYDRATION>(
          PENDING_HYDRATION
        );
        signals.set(this, state);

        if (apiOpts.persist) {
          const store = getStore(apiOpts.persist);
          const name = getPersistenceName(this, context);
          store.get(name).then((val) => {
            // Resolve the signal with either stored value or class default.
            if (val !== null) {
              state.set(val as any as Value);
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
