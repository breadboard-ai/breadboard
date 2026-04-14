/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A robust reactive effect implementation for the SCA architecture.
 *
 * ## Why We Have Our Own Implementation
 *
 * The `signal-utils` package provides a `microtask-effect` helper, but it has
 * documented limitations that may make it unsuitable for production use:
 *
 * 1. **Memory leak warning** (from signal-utils source):
 *    > "⚠️ WARNING: Nothing unwatches. This will produce a memory leak."
 *
 * 2. **Shared watcher problem**: All effects share a single global watcher.
 *    When the watcher's notify callback fires, it calls `watcher.watch()` with
 *    no arguments (line 24 of microtask-effect.ts). This is meant to "resume
 *    watching all previously unwatched signals", but in practice it doesn't
 *    reliably re-establish subscriptions when effects read different signals
 *    on different executions.
 *
 * 3. **Single effect reliability**: With one effect, if its dependencies change
 *    between runs, the shared watcher may not properly track the new
 *    dependencies, causing the effect to stop firing.
 *
 * ## How Our Implementation Differs
 *
 * This implementation creates a **dedicated watcher per effect** and explicitly
 * re-watches the computed signal before each execution:
 *
 * ```typescript
 * watcher.watch(computed);  // Explicit re-watch
 * computed.get();           // Then execute
 * ```
 *
 * This ensures the dependency graph is always correctly re-established.
 *
 * ## Deferred Initial Execution
 *
 * The initial effect execution is scheduled on a microtask, not run
 * synchronously. This allows setup code (like trigger registration) to complete
 * before effects first run. In tests, use `flushEffects()` to wait for pending
 * effects.
 *
 * @see node_modules/signal-utils/src/subtle/microtask-effect.ts for the original
 * @see triggers/README.md for testing guidance
 * @module
 */

import { Signal } from "signal-polyfill";

/**
 * Creates a reactive effect that runs the callback whenever its signal
 * dependencies change.
 *
 * @param callback - Function to run reactively. Any signals read during
 *   execution become dependencies that will trigger re-execution when changed.
 * @returns A dispose function to stop the effect and clean up resources.
 *   **Important:** Always capture and call this to prevent memory leaks.
 *
 * @example
 * ```typescript
 * import { reactive } from "./sca/reactive.js";
 *
 * const count = new Signal.State(0);
 *
 * // Effect runs immediately (deferred to microtask) and whenever count changes
 * const dispose = reactive(() => {
 *   console.log('Count is:', count.get());
 * });
 *
 * count.set(1); // Logs: "Count is: 1" (on next microtask)
 * count.set(2); // Logs: "Count is: 2" (on next microtask)
 *
 * // Clean up when done
 * dispose();
 * ```
 *
 * @example
 * ```typescript
 * // In a LitElement with lifecycle management
 * class MyElement extends LitElement {
 *   #disposeEffect: (() => void) | null = null;
 *
 *   connectedCallback() {
 *     super.connectedCallback();
 *     this.#disposeEffect = reactive(() => {
 *       // React to signal changes
 *     });
 *   }
 *
 *   disconnectedCallback() {
 *     this.#disposeEffect?.();
 *     this.#disposeEffect = null;
 *     super.disconnectedCallback();
 *   }
 * }
 * ```
 */
export function reactive(callback: () => void): () => void {
  let disposed = false;
  const computed = new Signal.Computed(callback);

  const watcher = new Signal.subtle.Watcher(() => {
    // Schedule effect execution on the microtask queue
    queueMicrotask(() => {
      if (disposed) return; // Skip if disposed
      // Re-watch BEFORE getting the value to ensure we capture new dependencies
      watcher.watch(computed);
      computed.get();
    });
  });

  // Initial setup: watch the computed and schedule initial execution on microtask
  // Deferring allows setup code (like trigger registration) to complete first
  watcher.watch(computed);
  queueMicrotask(() => {
    if (disposed) return; // Skip if disposed
    computed.get();
  });

  // Return dispose function
  return () => {
    disposed = true;
    watcher.unwatch(computed);
  };
}
