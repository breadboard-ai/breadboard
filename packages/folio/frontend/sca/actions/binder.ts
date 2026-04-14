/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionBind, AppController } from "../types.js";

/**
 * Returns true if the keyboard event originated from within the graph renderer
 * (`<bb-renderer>`). Used as a `guard` for keyboard triggers that should only
 * fire when the renderer has focus (e.g. Delete, Undo, Copy).
 *
 * Uses tag-name matching instead of `instanceof Renderer` to avoid importing
 * the heavy UI element module into the SCA action graph.
 */
export function isFocusedOnGraphRenderer(evt: KeyboardEvent): boolean {
  return evt
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLElement &&
        target.tagName.toLowerCase() === "bb-renderer"
    );
}

type DefaultBindings = ActionBind;

/**
 * Defines the hybrid type:
 * 1. It is a function that accepts the dependencies (Setter).
 * 2. It holds the dependencies as properties (Getter).
 */
type Action<T> = ((deps: T) => void) & T;

/**
 * Creates a dependency injection binder for Actions.
 *
 * The returned object serves dual purposes:
 * 1. **As a function**: Call with dependencies to bind them: `bind({ controller, services })`
 * 2. **As an object**: Access dependencies via properties: `bind.controller`, `bind.services`
 *
 * This pattern allows Actions to be defined as standalone functions that receive
 * their dependencies via closure rather than parameter passing.
 *
 * **How it works:**
 * Uses a JavaScript Proxy to intercept property access. When you access `bind.controller`,
 * the Proxy returns the bound dependency (or throws if not yet bound).
 *
 * **Example:**
 * ```typescript
 * // At module level
 * export const bind = makeAction();
 *
 * // During bootstrap (in actions.ts)
 * bind({ controller, services });
 *
 * // Define actions using asAction() from coordination.ts
 * export const myAction = asAction("MyAction", ActionMode.Awaits, async () => {
 *   const { controller, services } = bind;
 *   // Use controller and services
 * });
 * ```
 *
 * @returns A Proxy that acts as both setter and getter for dependencies
 */
export function makeAction<T extends DefaultBindings>(): Action<T> {
  let deps: T | undefined;

  const setter = (newDeps: T) => {
    deps = newDeps;
  };

  // This intercepts property access like `bind.controller` and either returns
  // or throws if the values are not set.
  return new Proxy(setter, {
    get(_target, prop, receiver) {
      if (deps && prop in deps) {
        return Reflect.get(deps, prop, receiver);
      }

      throw new Error("Not set");
    },
  }) as Action<T>;
}

/**
 * Runs an async callback while the `blockingAction` flag is set on the
 * controller. The flag is always cleared in a `finally` block.
 *
 * This is the standard pattern for actions triggered by user events that
 * perform async operations: we block the UI to prevent concurrent
 * edits, run the work, then unblock.
 *
 * @param controller App controller whose `blockingAction` flag to manage
 * @param fn The async work to run while blocking
 */
export async function withUIBlocking(
  controller: AppController,
  fn: () => Promise<void>
): Promise<void> {
  controller.global.blockingAction = true;
  try {
    await fn();
  } finally {
    controller.global.blockingAction = false;
  }
}
