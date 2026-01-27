/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import { type AppActions } from "../actions/actions.js";
import { effect } from "signal-utils/subtle/microtask-effect";

export type DefaultBindings = {
  controller: AppController;
  services: AppServices;
  actions: AppActions;
};

interface EffectTrigger {
  register: (name: string, cb: () => void) => void;
  clean: () => void;
  list: () => string[];
}

/**
 * Defines the hybrid type:
 * 1. It is a function that accepts the dependencies (Setter).
 * 2. It holds the dependencies as properties (Getter).
 * 3. It has a register method to register effects.
 * 4. It has a clean method to clean up effects.
 */
export type Trigger<T> = ((deps: T) => void) & T & EffectTrigger;

export function makeTrigger<T extends DefaultBindings>(): Trigger<T> {
  let deps: T | undefined;
  // Per-instance disposers map to keep triggers isolated by category.
  const disposers: Map<string, () => void> = new Map();

  const setter = (newDeps: T) => {
    deps = newDeps;
  };

  // This intercepts property access like `bind.controller` and either returns
  // or throws if the values are not set.
  return new Proxy(setter, {
    get(_target, prop, receiver) {
      if (prop === "register") {
        return (name: string, cb: () => void) => {
          disposers.set(name, effect(cb));
        };
      } else if (prop === "clean") {
        return () => {
          for (const [, disposer] of disposers) {
            disposer.call(null);
          }
          disposers.clear();
        };
      } else if (prop === "list") {
        return () => {
          return [...disposers.keys()];
        };
      }

      if (deps && prop in deps) {
        return Reflect.get(deps, prop, receiver);
      }

      throw new Error("Not set");
    },
  }) as Trigger<T>;
}
