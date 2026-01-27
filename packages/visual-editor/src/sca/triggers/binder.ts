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

/**
 * Creates a dependency injection binder for Triggers with effect management.
 *
 * Similar to `makeAction()`, but with additional methods for reactive effect registration:
 * - `bind.register(name, callback)`: Register an effect that re-runs when signals change
 * - `bind.clean()`: Stop all registered effects (useful for testing)
 * - `bind.list()`: Get names of all registered effects
 *
 * **How effects work:**
 * When you call `bind.register()`, the callback is wrapped in `signal-utils/subtle/microtask-effect`.
 * Any signals read during execution become dependencies. When those signals change,
 * the effect automatically re-runs.
 *
 * **Example:**
 * ```typescript
 * export const bind = makeTrigger();
 *
 * export function registerAutonameTrigger() {
 *   bind.register("Autoname", async () => {
 *     const { controller, services } = bind;
 *
 *     // Reading this signal registers it as a dependency
 *     const change = controller.editor.graph.lastNodeConfigChange;
 *     if (!change) return;
 *
 *     // Side effect runs when lastNodeConfigChange updates
 *     await services.autonamer.autoname(change);
 *   });
 * }
 * ```
 *
 * @returns A Proxy with setter/getter behavior plus effect management methods
 */
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
