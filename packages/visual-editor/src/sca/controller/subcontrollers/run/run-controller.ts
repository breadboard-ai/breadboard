/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConsoleEntry,
  HarnessRunner,
  NodeIdentifier,
  NodeRunStatus,
  OutputValues,
  RunError,
  Schema,
  WorkItem,
} from "@breadboard-ai/types";
import { STATUS } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Re-export STATUS for consumers that need it.
 */
export { STATUS };

/**
 * Represents user input request.
 */
export type UserInput = {
  id: NodeIdentifier;
  schema: Schema;
};

/**
 * Payload for a requested node action (run/stop/runFrom etc).
 * Set on RunController to trigger pre-action orchestration.
 */
export type NodeActionRequest = {
  nodeId: string;
  actionContext: "graph" | "step";
};

/**
 * Controller for run lifecycle, status, and output state.
 *
 * This controller owns all state related to a single run of the board:
 * - Lifecycle: status, runner, abort controller
 * - Output: console entries, input requests, errors
 *
 * Note: This controller does NOT store the graph itself. Node metadata lookups
 * are performed by Triggers that have access to Services (graphStore), keeping
 * the Controller decoupled from Services.
 */
export class RunController extends RootController {
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Current run status.
   * Tracks whether the board is stopped, running, or paused.
   */
  @field()
  private accessor _status: STATUS = STATUS.STOPPED;

  /**
   * Whether a run has ever been started in this session.
   * Non-reactive, non-persisted — purely for progress calculation.
   * Set to true when status becomes RUNNING, cleared on reset().
   */
  private _runEverStarted = false;

  /**
   * The current HarnessRunner.
   * Set by actions when preparing a run.
   */
  @field({ deep: false })
  accessor runner: HarnessRunner | null = null;

  /**
   * The AbortController for the current run.
   * Used to stop the run. Not reactive as it's used imperatively.
   */
  accessor abortController: AbortController | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Console entries representing the run's output.
   * Populated by OutputTrigger listening to runner events.
   */
  @field({ deep: true })
  private accessor _console: Map<string, ConsoleEntry> = new Map();

  /**
   * Current input request the run is waiting for.
   * Set when the runner pauses for user input.
   */
  @field()
  private accessor _input: UserInput | null = null;

  /**
   * Set of node IDs that currently have pending input requests.
   * Used to support multiple concurrent input requests from parallel nodes.
   */
  @field({ deep: true })
  private accessor _pendingInputNodeIds: Set<NodeIdentifier> = new Set();

  /**
   * Per-node input schemas for pending input requests.
   */
  @field({ deep: true })
  private accessor _inputSchemas: Map<NodeIdentifier, Schema> = new Map();

  /**
   * Per-node Promise resolve functions for pending input requests.
   * Non-reactive: this is imperative plumbing, not UI-driving state.
   */
  private _pendingInputResolvers = new Map<
    NodeIdentifier,
    (values: OutputValues) => void
  >();

  /**
   * Callback invoked when a node requests input.
   * Set by the action layer to handle cross-controller coordination
   * (bumping screens, setting renderer state, etc.).
   */
  onInputRequested: ((id: NodeIdentifier, schema: Schema) => void) | null =
    null;

  /**
   * Pending node action request.
   * Set by handleNodeAction, consumed by triggered actions.
   */
  @field()
  private accessor _nodeActionRequest: NodeActionRequest | null = null;

  /**
   * Fatal error from the run (if any).
   * Non-fatal node errors are tracked separately.
   */
  @field()
  private accessor _error: RunError | null = null;

  /**
   * Node IDs whose errors the user has dismissed.
   */
  @field({ deep: true })
  private accessor _dismissedErrors: Set<NodeIdentifier> = new Set();

  /**
   * Estimated total entries for progress calculation.
   * Initially based on node count, updated as run progresses.
   */
  @field()
  private accessor _estimatedEntryCount: number = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the current run status.
   */
  get status(): STATUS {
    return this._status;
  }

  /**
   * Updates the run status.
   * This is called in response to run lifecycle events.
   *
   * @param status The new run status
   */
  setStatus(status: STATUS): void {
    this._status = status;
    if (status === STATUS.RUNNING) {
      this._runEverStarted = true;
    }
  }

  /**
   * Sets the runner and abort controller.
   * Called by RunActions.prepare() after creating the runner.
   *
   * @param runner The HarnessRunner
   * @param abortController The AbortController for this run
   */
  setRunner(runner: HarnessRunner, abortController: AbortController): void {
    this.runner = runner;
    this.abortController = abortController;
  }

  /**
   * Clears the runner and abort controller.
   */
  clearRunner(): void {
    this.runner = null;
    this.abortController = null;
    this.onInputRequested = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the console entries map.
   */
  get console(): Map<string, ConsoleEntry> {
    return this._console;
  }

  /**
   * Adds or updates a console entry.
   * Uses immutable replacement to trigger @field signal.
   *
   * @param id The node identifier
   * @param entry The console entry (with resolved metadata)
   */
  setConsoleEntry(id: string, entry: ConsoleEntry): void {
    const updated = new Map(this._console);
    updated.set(id, entry);
    this._console = updated;
  }

  /**
   * Replaces the entire console with new entries.
   * Used for bulk updates (e.g., when graph topology changes).
   *
   * @param entries The new console entries
   */
  replaceConsole(entries: Map<string, ConsoleEntry>): void {
    this._console = new Map(entries);
  }

  /**
   * Gets the current input request (if any).
   */
  get input(): UserInput | null {
    return this._input;
  }

  /**
   * Sets the current input request.
   * Called when the runner pauses waiting for user input.
   *
   * @param input The input request with node ID and schema
   */
  setInput(input: UserInput): void {
    this._input = input;
  }

  /**
   * Clears the current input request.
   * Called when input is provided or run is cancelled.
   */
  clearInput(): void {
    this._input = null;
  }

  /**
   * Gets the pending input node IDs set.
   */
  get pendingInputNodeIds(): ReadonlySet<NodeIdentifier> {
    return this._pendingInputNodeIds;
  }

  /**
   * Gets the input schemas map.
   */
  get inputSchemas(): ReadonlyMap<NodeIdentifier, Schema> {
    return this._inputSchemas;
  }

  /**
   * Adds a pending input request to the queue.
   */
  addPendingInput(id: NodeIdentifier, schema: Schema): void {
    this._pendingInputNodeIds.add(id);
    this._inputSchemas.set(id, schema);
  }

  /**
   * Removes a pending input from the queue.
   */
  removePendingInput(id: NodeIdentifier): void {
    this._pendingInputNodeIds.delete(id);
    this._inputSchemas.delete(id);
  }

  /**
   * Gets the next pending input ID from the queue.
   * Returns undefined if no pending inputs remain.
   */
  get nextPendingInputId(): NodeIdentifier | undefined {
    return this._pendingInputNodeIds.values().next().value;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE ACTION REQUEST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the pending node action request (if any).
   * Watched by triggers to coordinate pre-action orchestration.
   */
  get nodeActionRequest(): NodeActionRequest | null {
    return this._nodeActionRequest;
  }

  /**
   * Sets a pending node action request.
   * Triggers pre-action orchestration (e.g. applying pending edits)
   * followed by action dispatch.
   */
  setNodeActionRequest(request: NodeActionRequest): void {
    this._nodeActionRequest = request;
  }

  /**
   * Clears the pending node action request.
   * Called after the action has been dispatched.
   */
  clearNodeActionRequest(): void {
    this._nodeActionRequest = null;
  }

  /**
   * Gets the fatal error (if any).
   */
  get error(): RunError | null {
    return this._error;
  }

  /**
   * Sets the fatal error.
   *
   * @param error The error from the run
   */
  setError(error: RunError): void {
    this._error = error;
  }

  /**
   * Dismisses the current error.
   * If a nodeId is provided, adds it to dismissed set.
   *
   * @param nodeId Optional node ID to track as dismissed
   */
  dismissError(nodeId?: NodeIdentifier): void {
    if (nodeId) {
      this._dismissedErrors.add(nodeId);
    }
    this._error = null;
  }

  /**
   * Removes a node from the dismissed errors set (un-dismiss).
   * Called before re-running a node so its error becomes visible again.
   */
  undismissError(id: NodeIdentifier): void {
    this._dismissedErrors.delete(id);
  }

  /**
   * Gets the set of dismissed error node IDs.
   */
  get dismissedErrors(): Set<NodeIdentifier> {
    return this._dismissedErrors;
  }

  /**
   * Gets the estimated entry count for progress calculation.
   * Returns the larger of the estimate and actual console size.
   */
  get estimatedEntryCount(): number {
    return Math.max(this._estimatedEntryCount, this._console.size);
  }

  /**
   * Sets the estimated entry count.
   * Typically set at run start based on graph node count.
   *
   * @param count The estimated number of entries
   */
  setEstimatedEntryCount(count: number): void {
    this._estimatedEntryCount = count;
  }

  /**
   * Resets all output state: console, input, errors, and estimate.
   */
  reset(): void {
    this._console.clear();
    this._input = null;
    this._pendingInputNodeIds.clear();
    this._inputSchemas.clear();
    this._pendingInputResolvers.clear();
    this._error = null;
    this._dismissedErrors.clear();
    this._estimatedEntryCount = 0;
    this._nodeActionRequest = null;
    this._runEverStarted = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Progress as a number between 0 and 1.
   * - Never ran (no run started in session): 0
   * - In progress (running/paused): reached entries / total entries
   * - Completed (stopped after a run): 1
   */
  get progress(): number {
    if (this._status === STATUS.RUNNING || this._status === STATUS.PAUSED) {
      if (this._console.size === 0) return 0;
      let reached = 0;
      for (const entry of this._console.values()) {
        const status = entry.status?.status;
        if (status && status !== "inactive") reached++;
      }
      return reached / this._console.size;
    }
    // Stopped: 1 if a run has completed, 0 if never ran.
    return this._runEverStarted ? 1 : 0;
  }

  /**
   * Console state: "start" if empty, "entries" otherwise.
   */
  get consoleState(): "start" | "entries" {
    return this._console.size > 0 ? "entries" : "start";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT LIFECYCLE (instance methods)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handles a requestInput call from a console entry.
   * Stores the resolve callback and schema, returns a Promise that resolves
   * when the user provides values via resolveInputForNode.
   */
  requestInputForNode(
    id: NodeIdentifier,
    schema: Schema
  ): Promise<OutputValues> {
    return new Promise((resolve) => {
      this._pendingInputResolvers.set(id, resolve);
      this._inputSchemas.set(id, schema);

      // Notify the action layer so it can handle cross-controller
      // coordination (bump screen, set renderer state, set reactive input).
      this.onInputRequested?.(id, schema);
    });
  }

  /**
   * Makes a pending input request visible by creating a WorkItem
   * on the console entry.
   */
  activateInputForNode(id: NodeIdentifier): void {
    const schema = this._inputSchemas.get(id);
    if (!schema) return;

    const entry = this._console.get(id);
    if (!entry) return;

    const workId = crypto.randomUUID();
    const item: WorkItem = {
      title: "Input",
      icon: "chat_mirror",
      start: performance.now(),
      end: null,
      elapsed: 0,
      awaitingUserInput: true,
      schema,
      product: new Map(),
    };
    entry.work.set(workId, item);
    entry.current = item;
  }

  /**
   * Resolves a pending input request with user-provided values.
   * Clears the stored schema and resolve callback.
   */
  resolveInputForNode(id: NodeIdentifier, values: OutputValues): void {
    const resolve = this._pendingInputResolvers.get(id);
    this._pendingInputResolvers.delete(id);
    resolve?.(values);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC FACTORIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a ConsoleEntry with all required fields initialized.
   * Use this factory to ensure entries have proper default values.
   *
   * Input methods (requestInput, activateInput, resolveInput) delegate to
   * the supplied RunController when provided.
   *
   * Note: When stored via setConsoleEntry, the entry is wrapped in a
   * SignalObject proxy (due to `@field({ deep: true })` on `_console`).
   * This means mutations to nested Maps (work, output) are automatically
   * tracked and trigger reactive updates in the UI.
   *
   * @param title - Display title for the step
   * @param status - Current status (inactive, working, succeeded, failed, etc.)
   * @param options - Optional icon, tags, id, and controller reference
   */
  static createConsoleEntry(
    title: string,
    status: NodeRunStatus,
    options?: {
      icon?: string;
      tags?: string[];
      id?: NodeIdentifier;
      controller?: RunController;
    }
  ): ConsoleEntry {
    const nodeId = options?.id;
    const ctrl = options?.controller;

    return {
      title,
      icon: options?.icon,
      tags: options?.tags,
      status: { status },
      open: false,
      rerun: false,
      work: new Map(),
      output: new Map(),
      error: null,
      completed: status === "succeeded",
      current: null,
      addOutput() {},
      requestInput(schema: Schema): Promise<OutputValues> {
        if (!ctrl || !nodeId) {
          return Promise.reject(new Error("No controller bound for input"));
        }
        return ctrl.requestInputForNode(nodeId, schema);
      },
      activateInput() {
        if (ctrl && nodeId) {
          ctrl.activateInputForNode(nodeId);
        }
      },
      resolveInput(values: OutputValues) {
        if (ctrl && nodeId) {
          ctrl.resolveInputForNode(nodeId, values);
        }
      },
    };
  }
}
