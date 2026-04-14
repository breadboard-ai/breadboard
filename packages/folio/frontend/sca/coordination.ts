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
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
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
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export interface SignalTrigger {
  type: "signal";
  name: string;
  /**
   * The condition callback. This is wrapped in a reactive effect.
   * - Signals read during execution become dependencies
   * - Return a truthy value when the action should fire, falsy otherwise
   * - The action fires when the return value CHANGES to a truthy value
   * - To fire on every change, return a unique value (e.g., version number)
   */
  condition: () => unknown;
}

/**
 * An event-based trigger that fires on DOM or custom events.
 */
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
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
 * A keyboard shortcut trigger that fires on key combinations.
 *
 * Key strings follow the format used by commands: "Cmd+s", "Ctrl+Shift+z", etc.
 * Modifier order is always: Shift → Cmd → Ctrl.
 */
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export interface KeyboardTrigger {
  type: "keyboard";
  name: string;
  /** Key combinations that activate this trigger, e.g. ["Cmd+s", "Ctrl+s"] */
  keys: string[];
  /** Optional guard: if provided, trigger only fires when guard returns true */
  guard?: (evt: KeyboardEvent) => boolean;
  /** Target element to listen on (default: window) */
  target?: EventTarget;
}

/**
 * Union of all trigger types.
 */
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type TriggerDefinition = SignalTrigger | EventTrigger | KeyboardTrigger;

/**
 * A factory function that creates a trigger definition.
 * This allows triggers to be evaluated lazily during activate() rather than at import time.
 * May return null in environments where window is not available.
 */
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
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
 * // Fire once when condition becomes true
 * const onEditorReady = signalTrigger("Editor Ready", () => !!editor);
 *
 * // Fire on every version change (return unique value per version)
 * const onVersionChange = signalTrigger("Version Change", () => {
 *   const { version, readOnly, editor } = bind.controller.editor.graph;
 *   if (readOnly || !editor) return false;
 *   return version + 1; // +1 because version 0 is falsy
 * });
 * ```
 */
export function signalTrigger(
  name: string,
  condition: () => unknown
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

/**
 * Creates a trigger that listens for a specific `StateEvent` on a bus.
 *
 * StateEvent always dispatches with `.type === "bbevent"`. This helper
 * listens for `"bbevent"` and filters by `detail.eventType` to match
 * the specific event (e.g. `"node.change"`).
 *
 * @param name Human-readable name for debugging/logging
 * @param target The EventTarget (typically `stateEventBus`)
 * @param eventType The logical event type (e.g. `"node.change"`)
 * @returns An EventTrigger definition
 */
export function stateEventTrigger(
  name: string,
  target: EventTarget,
  eventType: string
): EventTrigger {
  return {
    type: "event",
    name,
    target,
    eventType: "bbevent",
    filter: (evt: Event) =>
      (evt as CustomEvent).detail?.eventType === eventType,
  };
}

/**
 * Creates a keyboard shortcut trigger definition.
 *
 * @param name Human-readable name for debugging/logging
 * @param keys Array of key combinations (e.g., ["Cmd+s", "Ctrl+s"])
 * @param guard Optional guard function — action only fires when guard returns true
 * @param target Optional event target (defaults to window)
 * @returns A KeyboardTrigger definition
 *
 * @example
 * ```typescript
 * const onSave = keyboardTrigger("Save Shortcut", ["Cmd+s", "Ctrl+s"]);
 * const onDelete = keyboardTrigger(
 *   "Delete Shortcut",
 *   ["Delete", "Backspace"],
 *   (evt) => isFocusedOnGraphRenderer(evt)
 * );
 * ```
 */
export function keyboardTrigger(
  name: string,
  keys: string[],
  guard?: (evt: KeyboardEvent) => boolean,
  target?: EventTarget
): KeyboardTrigger {
  return { type: "keyboard", name, keys, guard, target };
}

// =============================================================================
// Keyboard Helpers
// =============================================================================

/**
 * Returns true if the event target is an element that has input preference
 * (text inputs, textareas, selects, canvas, contenteditable elements).
 * When these elements are focused, keyboard shortcuts should not fire.
 */
function receivesInputPreference(target: EventTarget): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLCanvasElement ||
    (target instanceof HTMLElement &&
      (target.contentEditable === "true" ||
        target.contentEditable === "plaintext-only"))
  );
}

/**
 * Normalizes a KeyboardEvent into the key string format used by triggers.
 * Format: modifiers are prepended in order Shift → Cmd → Ctrl.
 * Examples: "s", "Shift+z", "Cmd+s", "Ctrl+Shift+z"
 */
export function normalizeKeyCombo(evt: KeyboardEvent): string {
  let key = evt.key;
  if (key === "Meta" || key === "Control" || key === "Shift") {
    return "";
  }
  // Normalize single-character keys to lowercase so that
  // Shift+letter combos match regardless of platform casing.
  // (macOS with Cmd reports lowercase; Windows/Linux with Ctrl reports uppercase.)
  if (key.length === 1) {
    key = key.toLowerCase();
  }
  if (evt.shiftKey) {
    key = `Shift+${key}`;
  }
  if (evt.metaKey) {
    key = `Cmd+${key}`;
  }
  if (evt.ctrlKey) {
    key = `Ctrl+${key}`;
  }
  return key;
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
    mode: ActionMode;
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
      LABEL
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
      LABEL
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
      LABEL
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

    // Capture what was in-progress BEFORE we register (for Exclusive waiting).
    // Exclusive waits for other Awaits/Exclusive actions (serialization),
    // but NOT for Immediate actions — they are fire-and-forget by design.
    // Without this filter, a slow Immediate action (e.g. a network call)
    // would block every Exclusive action queued behind it.
    const existingInProgressPromises =
      mode === ActionMode.Exclusive
        ? [...this.#inProgressActions]
            .filter((a) => a.mode !== ActionMode.Immediate)
            .map((a) => a.promise)
        : [];

    // Register as in-progress FIRST (before waiting)
    let resolveInProgress: () => void;
    const inProgressPromise = new Promise<void>((resolve) => {
      resolveInProgress = resolve;
    });
    const inProgressEntry = {
      id: this.#nextInProgressId++,
      name,
      mode,
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
          LABEL
        );

        // Start a timeout warning for potential deadlocks
        const warningTimeout = setTimeout(() => {
          this.#logger.log(
            Utils.Logging.Formatter.warning(
              `⚠️ Possible deadlock: Exclusive action "${name}" has been waiting for over 10 seconds.\n` +
                `Waiting for: ${this.listInProgressActions().join(", ")}\n` +
                `This may indicate nested Exclusive actions. Consider using ActionMode.Awaits instead.`
            ),
            LABEL
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
          LABEL
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
        LABEL
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
                LABEL
              );
            });
          } else {
            // Two distinct non-firing cases, both logged at verbose level.
            // Runtime detection is useful for initial discovery, but the
            // ongoing safety net is unit tests (see *-triggers.test.ts files
            // for "no Sticky Trigger" regression tests).
            if (previousValue) {
              if (!value) {
                // Truthy → falsy: normal lifecycle (board close, readOnly
                // toggle, presence-based trigger going silent).
                this.#logger.log(
                  Utils.Logging.Formatter.verbose(
                    `Signal trigger "${trigger.name}" went from truthy to ` +
                      `falsy. The action "${actionName}" will not fire. ` +
                      `(This is expected during lifecycle transitions.)`
                  ),
                  LABEL
                );
              } else {
                // Same truthy value re-evaluated: signal noise (e.g., @field
                // setter fired without the underlying value changing).
                this.#logger.log(
                  Utils.Logging.Formatter.verbose(
                    `Signal trigger "${trigger.name}" returned the same ` +
                      `truthy value. The action "${actionName}" will not ` +
                      `re-fire. (Same value = no change = no action.)`
                  ),
                  LABEL
                );
              }
            }
            previousValue = value;
          }
        });
        disposers.push(dispose);

        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `Activated signal trigger: ${trigger.name} -> ${actionName}`
          ),
          LABEL
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
              LABEL
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
          LABEL
        );
      } else if (trigger.type === "keyboard") {
        // Keyboard trigger: listen for keydown and match key combos
        const target = trigger.target ?? globalThis.window;
        if (!target) {
          // SSR or test environment — skip
          continue;
        }

        const handler = async (rawEvt: Event) => {
          const evt = rawEvt as KeyboardEvent;

          // Skip when focused on inputs/textareas/etc.
          if (evt.composedPath().some((t) => receivesInputPreference(t))) {
            return;
          }

          // Normalize and match
          const normalized = normalizeKeyCombo(evt);
          if (!normalized || !trigger.keys.includes(normalized)) {
            return;
          }

          // Apply guard if provided
          if (trigger.guard && !trigger.guard(evt)) {
            return;
          }

          evt.preventDefault();
          evt.stopImmediatePropagation();

          try {
            await (action as (evt: KeyboardEvent) => Promise<unknown>)(evt);
          } catch (err) {
            this.#logger.log(
              Utils.Logging.Formatter.error(
                `Trigger ${trigger.name} -> ${actionName} failed:`,
                err
              ),
              LABEL
            );
          }
        };

        target.addEventListener("keydown", handler);
        disposers.push(() => {
          target.removeEventListener("keydown", handler);
        });

        this.#logger.log(
          Utils.Logging.Formatter.verbose(
            `Activated keyboard trigger: ${trigger.name} (${trigger.keys.join(", ")}) -> ${actionName}`
          ),
          LABEL
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
        LABEL
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
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export interface ActionOptions {
  /** Coordination mode: Immediate, Awaits, or Exclusive */
  mode: ActionMode;
  /**
   * Optional trigger that invokes this action automatically.
   * Must be a factory function `() => TriggerDefinition | null`.
   * Factory is called lazily during activate() to avoid import-time issues.
   * Factory may return null in SSR environments (trigger is not activated).
   *
   * Only one trigger per action is allowed. If you need to react to multiple
   * signals, compose them into a single trigger that reads all relevant signals.
   */
  triggeredBy?: TriggerFactory;
  /**
   * Optional activation priority. Higher values activate first.
   * Default is 0. Use to ensure actions that must complete before others
   * (like applying pending edits before autosave) activate in the right order.
   */
  priority?: number;
  /**
   * If true, the action is called once immediately after activation.
   * Use this to reconcile persisted controller state with current reality
   * on boot (e.g., sidebar section may be persisted as "editor" but
   * there's no selection after a page refresh).
   */
  runOnActivate?: boolean;
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
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type AppAction<TArgs extends unknown[] = []> = (
  ...args: TArgs
) => Promise<unknown>;

/**
 * An action function that may have associated triggers.
 *
 * - Call the function directly to execute the action
 * - Call `activate()` to start listening for trigger (returns a dispose function)
 * - Access `trigger` to inspect the trigger factory
 */
// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export interface ActionWithTriggers<T extends AppAction<never[]>> {
  /** Execute the action directly */
  (...args: Parameters<T>): ReturnType<T>;
  /** Action name for debugging */
  readonly actionName: string;
  /** Activation priority (higher = activates first, default 0) */
  readonly priority: number;
  /** Whether the action should run once immediately after activation */
  readonly runOnActivate: boolean;
  /** Start listening for trigger. Returns a dispose function. */
  activate: () => () => void;
  /** The trigger factory, if any (for debugging/inspection) */
  trigger: TriggerFactory | undefined;
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

  const {
    mode,
    triggeredBy,
    priority: rawPriority = 0,
    runOnActivate = false,
  } = normalizedOptions;

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
      LABEL
    );
  }

  // Register with coordination system
  const wrapped = coordination.registerAction(name, mode, fn);

  // Create the ActionWithTriggers object
  // Note: trigger is stored as factory, resolved lazily in activate()
  const actionWithTriggers = Object.assign(wrapped, {
    actionName: name,
    priority,
    runOnActivate,
    trigger: triggeredBy,
    activate: () => {
      // Resolve trigger factory lazily here, not at import time
      // Return no-op if no trigger or factory returns null (SSR)
      if (!triggeredBy) {
        return () => {};
      }
      const resolvedTrigger = triggeredBy();
      if (!resolvedTrigger) {
        return () => {};
      }
      return coordination.activateTriggers(name, [resolvedTrigger], wrapped);
    },
  });

  return actionWithTriggers as unknown as ActionWithTriggers<T>;
}
