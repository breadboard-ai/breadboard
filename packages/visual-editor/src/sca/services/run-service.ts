/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPlanRunner } from "../../engine/runtime/harness/index.js";
import type { HarnessRunner, RunConfig } from "@breadboard-ai/types";

/**
 * Result of createRunner - the harness runner and abort controller.
 */
export interface CreateRunnerResult {
  runner: HarnessRunner;
  abortController: AbortController;
}

/**
 * All runner event types that are forwarded through the event bus.
 *
 * Each runner event is re-dispatched as a `CustomEvent` on the stable
 * `runnerEventBus`, preserving the original `data` property in `detail`.
 */
const RUNNER_EVENT_TYPES = [
  "start",
  "pause",
  "resume",
  "output",
  "error",
  "skip",
  "graphstart",
  "graphend",
  "nodestart",
  "nodeend",
  "end",
  "nodestatechange",
  "edgestatechange",
] as const;

/**
 * SCA Run Service — handles runner creation and provides a stable event bus.
 *
 * The HarnessRunner is ephemeral: it is recreated on every topology change.
 * `eventTrigger` definitions, however, need a stable `EventTarget` that lives
 * for the lifetime of the application.
 *
 * This service bridges the gap by owning a `runnerEventBus` that proxies
 * events from whichever runner is currently active. When a new runner is
 * created, call {@link registerRunner} to swap the forwarding.
 *
 * @example
 * ```typescript
 * // In RunActions.prepare():
 * const { runner, abortController } = runService.createRunner(config);
 * runService.registerRunner(runner);
 * runController.setRunner(runner, abortController);
 * ```
 */
export class RunService {
  /**
   * Stable EventTarget that proxies events from the current runner.
   *
   * SCA `eventTrigger` definitions point at this bus rather than at the
   * ephemeral runner. Event listeners registered on this bus receive
   * `CustomEvent` instances whose `detail` carries the original event's
   * `data` property.
   */
  readonly runnerEventBus: EventTarget = new EventTarget();

  /**
   * Cleanup callback for the previous runner's forwarding listeners.
   * Called when a new runner is registered.
   */
  #cleanupPreviousRunner: (() => void) | null = null;

  /**
   * Creates a new HarnessRunner and AbortController.
   *
   * The config should already have signal and graphStore set.
   * The caller (action) is responsible for registering the runner on the
   * service and setting it on the controller.
   *
   * @param config The run configuration
   * @returns The created runner and abort controller
   */
  createRunner(config: RunConfig): CreateRunnerResult {
    const abortController = new AbortController();

    // Merge the abort signal into the config
    const configWithSignal: RunConfig = {
      ...config,
      signal: abortController.signal,
    };

    const runner = createPlanRunner(configWithSignal);

    return {
      runner,
      abortController,
    };
  }

  /**
   * Registers a runner as the current event source.
   *
   * All known event types are forwarded from the runner to the stable
   * `runnerEventBus` as `CustomEvent`s. Any previously registered runner's
   * forwarding listeners are removed first.
   *
   * @param runner The new HarnessRunner to forward events from
   */
  registerRunner(runner: HarnessRunner): void {
    // Clean up old forwarding if present.
    this.#cleanupPreviousRunner?.();

    // Build forwarding listeners and track them for later removal.
    const forwarders: Array<{ type: string; handler: (evt: Event) => void }> =
      [];

    for (const eventType of RUNNER_EVENT_TYPES) {
      const handler = (evt: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (evt as any).data;
        this.runnerEventBus.dispatchEvent(
          new CustomEvent(eventType, { detail: data })
        );
      };

      runner.addEventListener(eventType, handler);
      forwarders.push({ type: eventType, handler });
    }

    this.#cleanupPreviousRunner = () => {
      for (const { type, handler } of forwarders) {
        runner.removeEventListener(type, handler);
      }
    };
  }

  /**
   * Removes all forwarding listeners from the current runner (if any).
   * Called when the runner is cleared or the service is torn down.
   */
  unregisterRunner(): void {
    this.#cleanupPreviousRunner?.();
    this.#cleanupPreviousRunner = null;
  }
}
