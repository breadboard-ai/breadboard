/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";
import { ToastType } from "../../ui/events/events.js";
import { STATUS } from "../../ui/types/types.js";

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

type DefaultBindings = {
  controller: AppController;
  services: AppServices;
};

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
 * Configuration for toast notifications during a blocking action.
 */
export interface ToastConfig {
  /** Message shown while the action is in progress */
  pending?: string;
  /** Message shown when the action completes successfully */
  complete?: string;
  /** Toast type for the completion message (default: INFORMATION) */
  completeType?: ToastType;
  /** Milliseconds before showing the pending toast (default: 500). Ignored if alwaysNotify is true. */
  timeout?: number;
  /** If true, show the pending toast immediately instead of after a timeout */
  alwaysNotify?: boolean;
}

/**
 * Runs an async callback while the `blockingAction` flag is set on the
 * controller. The flag is always cleared in a `finally` block.
 *
 * When a `toast` config is provided, a pending toast is shown (immediately
 * or after a timeout), replaced by a success or error toast on completion.
 *
 * This is the standard pattern for actions triggered by user events that
 * perform async editor operations: we block the UI to prevent concurrent
 * edits, run the work, then unblock.
 *
 * @param controller App controller whose `blockingAction` flag to manage
 * @param fn The async work to run while blocking
 * @param toast Optional toast notification config
 */
export async function withUIBlocking(
  controller: AppController,
  fn: () => Promise<void>,
  toast?: ToastConfig
): Promise<void> {
  controller.global.main.blockingAction = true;

  let toastId: `${string}-${string}-${string}-${string}-${string}` | undefined;
  let notifyTimeout: ReturnType<typeof setTimeout> | undefined;

  if (toast) {
    const showPending = () => {
      if (toast.pending) {
        // PENDING = 1 from ToastType enum
        toastId = controller.global.toasts.toast(
          toast.pending,
          ToastType.PENDING,
          true
        );
      }
    };

    if (toast.alwaysNotify) {
      showPending();
    } else {
      notifyTimeout = setTimeout(showPending, toast.timeout ?? 500);
    }
  }

  try {
    await fn();

    if (toast?.complete && toastId) {
      // Replace the pending toast with the completion toast.
      // Default to INFORMATION = 0.
      controller.global.toasts.toast(
        toast.complete,
        toast.completeType ?? ToastType.INFORMATION,
        false,
        toastId
      );
    }
  } catch (err) {
    const message =
      (err as { message?: string })?.message ?? "An error occurred";
    controller.global.toasts.toast(message, ToastType.ERROR, false, toastId);
  } finally {
    if (notifyTimeout) {
      clearTimeout(notifyTimeout);
    }
    controller.global.main.blockingAction = false;
  }
}

/**
 * Aborts any in-progress run and resets all run-related controller state.
 *
 * This consolidates the abort → reset → setStatus(STOPPED) pattern that
 * appears in multiple action domains (board, flowgen, run).
 *
 * @param controller App controller whose run sub-controllers to reset
 */
export function stopRun(controller: AppController): void {
  const { run } = controller;
  if (run.main.abortController) {
    run.main.abortController.abort();
  }
  run.main.reset();
  run.screen.reset();
  run.renderer.reset();
  run.main.setStatus(STATUS.STOPPED);
}
