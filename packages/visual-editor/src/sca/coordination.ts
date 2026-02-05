/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Trigger-Action Coordination Registry
 *
 * Provides ordering guarantees between reactive triggers and imperative actions.
 *
 * **Problem solved:**
 * When a user edits a node and immediately clicks "Run", the config save trigger
 * may not complete before the run action starts, causing the graph to execute
 * with stale configuration.
 *
 * **Solution:**
 * - Triggers register themselves as "active" during execution
 * - Actions declare their coordination mode (immediate, awaits, exclusive)
 * - Actions with `awaits` or `exclusive` mode WAIT for active triggers
 * - Cycle detection: if the same action is called while already in-progress, throw
 *
 * **Action Modes:**
 * - `immediate`: Fire and forget - no waiting, no cycle detection
 * - `awaits`: Wait for triggers, throw if same action re-enters (cycle)
 * - `exclusive`: Like awaits, but also waits for other in-progress actions
 */

import { Utils } from "./utils.js";
import { reactive } from "./reactive.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Action coordination modes.
 */
export enum ActionMode {
  /** Runs without waiting - for actions called from triggers, pure UI updates */
  Immediate = "immediate",
  /** Throws if called while triggers are active - use from user events only */
  Awaits = "awaits",
  /** Like Awaits but also prevents concurrent exclusive actions */
  Exclusive = "exclusive",
}

/**
 * Metadata for a registered action.
 */
export interface ActionMetadata {
  name: string;
  mode: ActionMode;
}

// =============================================================================
// Trigger Definitions
// =============================================================================

/**
 * A signal-based trigger that fires when reactive dependencies change.
 */
export interface SignalTrigger {
  type: "signal";
  name: string;
  /**
   * The condition callback. This is wrapped in a reactive effect.
   * - Signals read during execution become dependencies
   * - Return true when the action should fire, false otherwise
   * - The reactive system detects when dependencies change; the boolean
   *   controls whether the action fires on that change
   */
  condition: () => boolean;
}

/**
 * An event-based trigger that fires on DOM or custom events.
 */
export interface EventTrigger {
  type: "event";
  name: string;
  target: EventTarget;
  eventType: string;
  /**
   * Optional filter function. If provided, action only fires when filter returns true.
   */
  filter?: (evt: Event) => boolean;
}

/**
 * Union of all trigger types.
 */
export type TriggerDefinition = SignalTrigger | EventTrigger;

/**
 * A factory function that creates a trigger definition.
 * This allows triggers to be evaluated lazily during activate() rather than at import time.
 * May return null in environments where window is not available.
 */
export type TriggerFactory = () => TriggerDefinition | null;

/**
 * Creates a signal-based trigger definition.
 *
 * The condition callback is wrapped in a reactive effect. When it returns
 * true (and was previously false), the associated action fires.
 *
 * @param name Human-readable name for debugging/logging
 * @param condition Callback that reads signals and returns true to fire action
 * @returns A SignalTrigger definition
 *
 * @example
 * ```typescript
 * const onSaveNeeded = signalTrigger("Save Needed", () => {
 *   const { version, readOnly, editor } = bind.controller.editor.graph;
 *   return !readOnly && version >= 0 && !!editor;
 * });
 * ```
 */
export function signalTrigger(
  name: string,
  condition: () => boolean
): SignalTrigger {
  return { type: "signal", name, condition };
}

/**
 * Creates an event-based trigger definition.
 *
 * @param name Human-readable name for debugging/logging
 * @param target The EventTarget to listen on (e.g., window, document, element)
 * @param eventType The event type string (e.g., "click", "popstate")
 * @param filter Optional filter - action only fires when filter returns true
 * @returns An EventTrigger definition
 *
 * @example
 * ```typescript
 * const onBeforeUnload = eventTrigger("Before Unload", window, "beforeunload");
 * const onPopstate = eventTrigger("Router URL Change", window, "popstate");
 * ```
 */
export function eventTrigger(
  name: string,
  target: EventTarget,
  eventType: string,
  filter?: (evt: Event) => boolean
): EventTrigger {
  return { type: "event", name, target, eventType, filter };
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Internal state for an active trigger.
 */
interface ActiveTrigger {
  name: string;
  promise: Promise<void>;
  resolve: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const LABEL = "Coordination";

// =============================================================================
// CoordinationRegistry
// =============================================================================

/**
 * Singleton registry for trigger-action coordination.
 *
 * @example
 * ```typescript
 * // In trigger binder
 * const done = coordination.enterTrigger("Save Trigger");
 * try {
 *   await saveConfiguration();
 * } finally {
 *   done();
 * }
 *
 * // In action registration
 * const run = coordination.registerAction("Run.prepare", "exclusive", async () => {
 *   // All pending triggers are complete by this point
 *   await prepareRunner();
 * });
 * ```
 */
class CoordinationRegistry {
  // Tracks triggers currently executing (name → Promise that resolves on completion)
  #activeTriggers = new Map<string, ActiveTrigger>();

  // Tracks actions currently in-progress (for cycle detection and exclusive waiting)
  // Use Set instead of Map to allow multiple concurrent calls to same action
  #inProgressActions = new Set<{
    id: number;
    name: string;
    promise: Promise<unknown>;
    resolve: () => void;
  }>();
  #nextInProgressId = 0;

  // Registry of all actions with their modes
  #registeredActions = new Map<string, ActionMetadata>();

  // Current execution stack (trigger and action names) - for debugging/logging
  #callStack: string[] = [];

  // Logger instance
  #logger = Utils.Logging.getLogger();

  // =========================================================================
  // Trigger Lifecycle
  // =========================================================================

  /**
   * Marks a trigger as entering execution.
   *
   * @param name - Unique name for this trigger invocation
   * @returns A `done` function to call when the trigger completes
   */
  enterTrigger(name: string): () => void {
    // Create a promise that will resolve when done() is called
    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    const trigger: ActiveTrigger = {
      name,
      promise,
      resolve: resolvePromise!,
    };

    this.#activeTriggers.set(name, trigger);

    this.#logger.log(
      Utils.Logging.Formatter.verbose("Trigger entered:", name),
      LABEL,
      false
    );

    // Return a function that marks the trigger as complete
    return () => {
      this.#exitTrigger(name);
    };
  }

  /**
   * Internal: removes trigger from active set and resolves waiters.
   */
  #exitTrigger(name: string): void {
    const trigger = this.#activeTriggers.get(name);
    if (trigger) {
      trigger.resolve();
      this.#activeTriggers.delete(name);
    }

    this.#logger.log(
      Utils.Logging.Formatter.verbose("Trigger exited:", name),
      LABEL,
      false
    );
  }

  // =========================================================================
  // Action Registration
  // =========================================================================

  /**
   * Registers an action with coordination semantics.
   *
   * @param name - Unique action name (e.g., "Run.prepare", "Board.load")
   * @param mode - Coordination mode: "immediate", "awaits", or "exclusive"
   * @param fn - The action implementation
   * @returns A wrapped function with coordination behavior
   */
  registerAction<T extends (...args: never[]) => Promise<unknown>>(
    name: string,
    mode: ActionMode,
    fn: T
  ): T {
    // Store metadata
    this.#registeredActions.set(name, { name, mode });

    // Create a wrapper that implements coordination logic
    const wrapper = async (
      ...args: Parameters<T>
    ): Promise<Awaited<ReturnType<T>>> => {
      return this.#executeAction(name, mode, () => fn(...args)) as Promise<
        Awaited<ReturnType<T>>
      >;
    };

    return wrapper as T;
  }

  /**
   * Internal: executes an action with the appropriate coordination.
   *
   * All modes are tracked in #inProgressActions so Exclusive can wait for them.
   *
   * - Immediate: No waiting, no cycle detection, IS tracked for Exclusive
   * - Awaits: Wait for triggers, cycle detection (same action throws)
   * - Exclusive: Wait for triggers + ALL in-progress actions (including self - queues)
   */
  async #executeAction<R>(
    name: string,
    mode: ActionMode,
    fn: () => Promise<R>
  ): Promise<R> {
    this.#logger.log(
      Utils.Logging.Formatter.verbose(`Action: ${name} (${mode})`, {
        activeTriggers: this.listActiveTriggers(),
        inProgressActions: this.listInProgressActions(),
        callStack: [...this.#callStack],
      }),
      LABEL,
      false
    );

    // Awaits mode: cycle detection - throw if same action already in progress
    // Immediate mode can re-enter freely
    // Exclusive mode will queue (wait for itself)
    const existingByName = [...this.#inProgressActions].find(
      (a) => a.name === name
    );
    if (mode === ActionMode.Awaits && existingByName) {
      throw new Error(
        `Cycle detected: Action "${name}" is already in progress.\n\n` +
          `This typically means a trigger-action chain is re-triggering itself.\n` +
          `In-progress actions: ${this.listInProgressActions().join(", ")}`
      );
    }

    // For Exclusive mode, we need to register FIRST to claim our spot in queue,
    // then wait for existing in-progress actions. This prevents race conditions
    // where multiple exclusive calls check in-progress at the same time.

    // Capture what was in-progress BEFORE we register (for Exclusive waiting)
    // Exclusive waits for ALL in-progress actions (serialization)
    const existingInProgressPromises =
      mode === ActionMode.Exclusive
        ? [...this.#inProgressActions].map((a) => a.promise)
        : [];

    // Register as in-progress FIRST (before waiting)
    let resolveInProgress: () => void;
    const inProgressPromise = new Promise<void>((resolve) => {
      resolveInProgress = resolve;
    });
    const inProgressEntry = {
      id: this.#nextInProgressId++,
      name,
      promise: inProgressPromise,
      resolve: resolveInProgress!,
    };
    this.#inProgressActions.add(inProgressEntry);

    try {
      // Exclusive mode: wait for actions that were in-progress when we started
      if (
        mode === ActionMode.Exclusive &&
        existingInProgressPromises.length > 0
      ) {
        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `${name} waiting for ${existingInProgressPromises.length} in-progress action(s)`
          ),
          LABEL,
          false
        );

        // Start a timeout warning for potential deadlocks
        const warningTimeout = setTimeout(() => {
          this.#logger.log(
            Utils.Logging.Formatter.warning(
              `⚠️ Possible deadlock: Exclusive action "${name}" has been waiting for over 10 seconds.\n` +
                `Waiting for: ${this.listInProgressActions().join(", ")}\n` +
                `This may indicate nested Exclusive actions. Consider using ActionMode.Awaits instead.`
            ),
            LABEL,
            false // force visible
          );
        }, 10_000);

        try {
          await Promise.all(existingInProgressPromises);
        } finally {
          clearTimeout(warningTimeout);
        }
      }

      // Awaits/Exclusive: wait for active triggers (Immediate skips)
      if (mode !== ActionMode.Immediate && this.#activeTriggers.size > 0) {
        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `${name} waiting for active triggers:`,
            this.listActiveTriggers()
          ),
          LABEL,
          false
        );
        await this.#waitForTriggers(name);
      }

      // Add to call stack AFTER waiting - so nested calls see parent,
      // but concurrent calls don't see each other during wait phase
      this.#callStack.push(name);

      return await fn();
    } finally {
      // Remove from call stack
      const idx = this.#callStack.lastIndexOf(name);
      if (idx !== -1) {
        this.#callStack.splice(idx, 1);
      }

      // Remove from in-progress and notify waiters
      inProgressEntry.resolve();
      this.#inProgressActions.delete(inProgressEntry);
    }
  }

  /**
   * Internal: waits for all active triggers to complete.
   */
  async #waitForTriggers(actionName: string): Promise<void> {
    const promises = [...this.#activeTriggers.values()].map((t) => t.promise);
    if (promises.length > 0) {
      this.#logger.log(
        Utils.Logging.Formatter.verbose(
          `${actionName} waiting for ${promises.length} trigger(s)`
        ),
        LABEL,
        false
      );
      await Promise.all(promises);
    }
  }

  // =========================================================================
  // Debug API
  // =========================================================================

  /**
   * Returns the names of all currently active triggers.
   */
  listActiveTriggers(): string[] {
    return [...this.#activeTriggers.keys()];
  }

  /**
   * Returns the names of all currently in-progress actions.
   */
  listInProgressActions(): string[] {
    return [...this.#inProgressActions].map((a) => a.name);
  }

  /**
   * Returns metadata for all registered actions.
   */
  listRegisteredActions(): ActionMetadata[] {
    return [...this.#registeredActions.values()];
  }

  /**
   * Returns the current call stack.
   */
  getCallStack(): string[] {
    return [...this.#callStack];
  }

  /**
   * Resets all coordination state. **For testing only.**
   */
  reset(): void {
    // Resolve any pending triggers
    for (const trigger of this.#activeTriggers.values()) {
      trigger.resolve();
    }
    this.#activeTriggers.clear();

    // Resolve any in-progress actions
    for (const action of this.#inProgressActions.values()) {
      action.resolve();
    }
    this.#inProgressActions.clear();

    // Clear state
    this.#registeredActions.clear();
    this.#callStack = [];
  }

  // =========================================================================
  // Trigger Activation
  // =========================================================================

  /**
   * Activates triggers for an action.
   *
   * Sets up reactive effects and event listeners that fire the action when
   * trigger conditions are met.
   *
   * @param actionName The action name (for logging)
   * @param triggers Array of trigger definitions
   * @param action The action function to call when triggers fire
   * @returns A dispose function to deactivate all triggers
   */
  activateTriggers(
    actionName: string,
    triggers: TriggerDefinition[],
    action: (...args: never[]) => Promise<unknown>
  ): () => void {
    if (triggers.length === 0) {
      return () => {}; // No-op dispose for actions without triggers
    }

    const disposers: Array<() => void> = [];

    for (const trigger of triggers) {
      if (trigger.type === "signal") {
        // Signal trigger: wrap in reactive effect
        let previousValue: unknown;
        const dispose = reactive(() => {
          const value = trigger.condition();
          // Only fire action when value becomes truthy and changed
          if (value && value !== previousValue) {
            previousValue = value;
            // Fire action but don't await (would cause issues in reactive context)
            // The action's own coordination handles waiting/cycle detection
            action().catch((err: Error) => {
              this.#logger.log(
                Utils.Logging.Formatter.error(
                  `Trigger ${trigger.name} -> ${actionName} failed:`,
                  err
                ),
                LABEL,
                false
              );
            });
          } else {
            previousValue = value;
          }
        });
        disposers.push(dispose);

        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `Activated signal trigger: ${trigger.name} -> ${actionName}`
          ),
          LABEL,
          false
        );
      } else if (trigger.type === "event") {
        // Event trigger: add event listener
        const handler = async (evt: Event) => {
          // Apply filter if provided
          if (trigger.filter && !trigger.filter(evt)) {
            return;
          }

          try {
            // The action's own coordination handles waiting/cycle detection
            await (action as (evt: Event) => Promise<unknown>)(evt);
          } catch (err) {
            this.#logger.log(
              Utils.Logging.Formatter.error(
                `Trigger ${trigger.name} -> ${actionName} failed:`,
                err
              ),
              LABEL,
              false
            );
          }
        };

        trigger.target.addEventListener(trigger.eventType, handler);
        disposers.push(() => {
          trigger.target.removeEventListener(trigger.eventType, handler);
        });

        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `Activated event trigger: ${trigger.name} (${trigger.eventType}) -> ${actionName}`
          ),
          LABEL,
          false
        );
      }
    }

    // Return combined dispose function
    return () => {
      for (const dispose of disposers) {
        dispose();
      }
      this.#logger.log(
        Utils.Logging.Formatter.verbose(
          `Deactivated triggers for: ${actionName}`
        ),
        LABEL,
        false
      );
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * The global coordination registry instance.
 */
export const coordination = new CoordinationRegistry();

// =============================================================================
// Action with Triggers
// =============================================================================

/**
 * Options for defining an action with coordination behavior.
 */
export interface ActionOptions {
  /** Coordination mode: Immediate, Awaits, or Exclusive */
  mode: ActionMode;
  /**
   * Optional triggers that invoke this action automatically.
   * Must be factory functions `() => TriggerDefinition | null` that return triggers.
   * Factories are called lazily during activate() to avoid import-time issues.
   * Factories may return null in SSR environments (these are filtered out).
   */
  triggeredBy?: TriggerFactory[];
  /**
   * Optional activation priority. Higher values activate first.
   * Default is 0. Use to ensure actions that must complete before others
   * (like applying pending edits before autosave) activate in the right order.
   */
  priority?: number;
}

/**
 * Base type for an action function.
 *
 * Actions are async functions that perform work. All action functions must:
 * - Be async (return a Promise)
 * - Accept optional parameters (for flexibility in triggering)
 *
 * This type is used for stricter typing of action functions passed to `asAction`.
 *
 * @example
 * ```typescript
 * // Simple action with no parameters
 * const myAction: AppAction = async () => { ... };
 *
 * // Action with optional event parameter (for event triggers)
 * const myEventAction: AppAction<[Event?]> = async (evt?) => { ... };
 *
 * // Action with required parameters (called directly, not triggered)
 * const myParameterizedAction: AppAction<[string, number]> = async (name, count) => { ... };
 * ```
 */
export type AppAction<TArgs extends unknown[] = []> = (
  ...args: TArgs
) => Promise<unknown>;

/**
 * An action function that may have associated triggers.
 *
 * - Call the function directly to execute the action
 * - Call `activate()` to start listening for triggers (returns a dispose function)
 * - Access `triggers` to inspect the trigger factories
 */
export interface ActionWithTriggers<T extends AppAction<never[]>> {
  /** Execute the action directly */
  (...args: Parameters<T>): ReturnType<T>;
  /** Action name for debugging */
  readonly actionName: string;
  /** Activation priority (higher = activates first, default 0) */
  readonly priority: number;
  /** Start listening for triggers. Returns a dispose function. */
  activate: () => () => void;
  /** List of trigger factories (for debugging/inspection) */
  triggers: readonly TriggerFactory[];
}

/**
 * Wraps an action function with coordination behavior and optional triggers.
 *
 * This is the primary way to define coordinated actions. The returned function:
 * - Can be called directly to execute the action
 * - Has an `activate()` method to start listening for triggers
 * - Participates in the coordination system based on its mode
 *
 * @param name Unique action name (e.g., "Board.save")
 * @param options Options object with mode and optional triggeredBy array
 * @param fn The action implementation
 * @returns The wrapped function with coordination behavior and trigger support
 *
 * @example
 * ```typescript
 * // Action without triggers (can still be called directly)
 * export const save = asAction(
 *   "Board.save",
 *   { mode: ActionMode.Awaits },
 *   async (messages) => {
 *     const { controller, services } = bind;
 *     // ... implementation
 *   }
 * );
 *
 * // Action with triggers (use factory functions)
 * export const autoSave = asAction(
 *   "Step.autoSave",
 *   {
 *     mode: ActionMode.Immediate,
 *     priority: 100,  // Higher = activates first
 *     triggeredBy: [
 *       () => onSelectionChange(bind),  // Factory function
 *       () => onSidebarChange(bind),
 *     ],
 *   },
 *   async () => {
 *     // ... implementation
 *   }
 * );
 *
 * // Activate triggers during bootstrap
 * const dispose = autoSave.activate();
 * // Later: dispose() to stop listening
 * ```
 */
export function asAction<T extends AppAction<never[]>>(
  name: string,
  options: ActionOptions | ActionMode,
  fn: T
): ActionWithTriggers<T> {
  // Normalize options - support both ActionMode directly or ActionOptions
  const normalizedOptions: ActionOptions =
    typeof options === "string" ? { mode: options } : options;

  const { mode, triggeredBy = [], priority: rawPriority = 0 } = normalizedOptions;

  // Clamp priority to reasonable bounds to prevent gaming
  const MIN_PRIORITY = -1000;
  const MAX_PRIORITY = 1000;
  const priority = Math.max(MIN_PRIORITY, Math.min(MAX_PRIORITY, rawPriority));
  if (rawPriority !== priority) {
    const logger = Utils.Logging.getLogger();
    logger.log(
      Utils.Logging.Formatter.warning(
        `Action "${name}" priority ${rawPriority} clamped to ${priority}. ` +
        `Use values between ${MIN_PRIORITY} and ${MAX_PRIORITY}.`
      ),
      LABEL,
      true  // Always show (not verbose)
    );
  }

  // Register with coordination system
  const wrapped = coordination.registerAction(name, mode, fn);

  // Create the ActionWithTriggers object
  // Note: triggers are stored as factories, resolved lazily in activate()
  const actionWithTriggers = Object.assign(wrapped, {
    actionName: name,
    priority,
    triggers: triggeredBy as readonly TriggerFactory[],
    activate: () => {
      // Resolve trigger factories lazily here, not at import time
      // Filter out null results (for SSR environments)
      const resolvedTriggers = triggeredBy
        .map((factory) => factory())
        .filter((t): t is TriggerDefinition => t !== null);
      return coordination.activateTriggers(name, resolvedTriggers, wrapped);
    },
  });

  return actionWithTriggers as unknown as ActionWithTriggers<T>;
}


