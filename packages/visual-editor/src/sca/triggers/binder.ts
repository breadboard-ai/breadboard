/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import { type AppActions } from "../actions/actions.js";
import { reactive } from "../reactive.js";

export type DefaultBindings = {
  controller: AppController;
  services: AppServices;
  actions: AppActions;
};

interface EffectTrigger {
  register: (name: string, cb: () => void) => void;
  registerEventBridge: (
    name: string,
    target: EventTarget,
    event: string,
    handler: EventListenerOrEventListenerObject
  ) => void;
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
 * - `bind.registerEventBridge(name, target, event, handler)`: Register a native event listener
 * - `bind.clean()`: Stop all registered effects and remove event listeners (useful for testing)
 * - `bind.list()`: Get names of all registered effects and event bridges
 *
 * **How effects work:**
 * When you call `bind.register()`, the callback is wrapped in `signal-utils/subtle/microtask-effect`.
 * Any signals read during execution become dependencies. When those signals change,
 * the effect automatically re-runs.
 *
 * **How event bridges work:**
 * When you call `bind.registerEventBridge()`, the handler is attached via `addEventListener`.
 * Unlike effects, these don't react to signals - they bridge external events into SCA state.
 * The listener is properly removed when `clean()` is called.
 *
 * **Example (effect-based trigger):**
 * ```typescript
 * export const bind = makeTrigger();
 *
 * export function registerAutonameTrigger() {
 *   bind.register("Autoname", async () => {
 *     const { controller, services } = bind;
 *     const change = controller.editor.graph.lastNodeConfigChange;
 *     if (!change) return;
 *     await services.autonamer.autoname(change);
 *   });
 * }
 * ```
 *
 * **Example (event bridge):**
 * ```typescript
 * export function registerPopstateTrigger() {
 *   bind.registerEventBridge(
 *     "Router URL Change",
 *     window,
 *     "popstate",
 *     () => bind.controller.router.updateFromCurrentUrl()
 *   );
 * }
 * ```
 *
 * @returns A Proxy with setter/getter behavior plus effect management methods
 */
export function makeTrigger<T extends DefaultBindings>(): Trigger<T> {
  let deps: T | undefined;
  // Per-instance disposers map to keep triggers isolated by category.
  const disposers: Map<string, () => void> = new Map();
  // Event bridge registrations for proper cleanup of native listeners.
  const eventBridges: Map<
    string,
    { target: EventTarget; event: string; handler: EventListenerOrEventListenerObject }
  > = new Map();

  const setter = (newDeps: T) => {
    deps = newDeps;
  };

  // This intercepts property access like `bind.controller` and either returns
  // or throws if the values are not set.
  return new Proxy(setter, {
    get(_target, prop, receiver) {
      if (prop === "register") {
        return (name: string, cb: () => void) => {
          disposers.set(name, reactive(cb));
        };
      } else if (prop === "registerEventBridge") {
        return (
          name: string,
          target: EventTarget,
          event: string,
          handler: EventListenerOrEventListenerObject
        ) => {
          // Store for cleanup
          eventBridges.set(name, { target, event, handler });
          // Add the listener
          target.addEventListener(event, handler);
        };
      } else if (prop === "clean") {
        return () => {
          // Clean up effect-based triggers
          for (const [, disposer] of disposers) {
            disposer.call(null);
          }
          disposers.clear();
          // Clean up event bridge listeners
          for (const [, bridge] of eventBridges) {
            bridge.target.removeEventListener(bridge.event, bridge.handler);
          }
          eventBridges.clear();
        };
      } else if (prop === "list") {
        return () => {
          const effectNames = [...disposers.keys()].map((n) => `[effect] ${n}`);
          const bridgeNames = [...eventBridges.keys()].map(
            (n) => `[bridge] ${n}`
          );
          return [...effectNames, ...bridgeNames];
        };
      }

      if (deps && prop in deps) {
        return Reflect.get(deps, prop, receiver);
      }

      throw new Error("Not set");
    },
  }) as Trigger<T>;
}
