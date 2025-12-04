/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  AppScreenOutput,
  NodeEndResponse,
} from "@breadboard-ai/types";
import { OutputResponse, Schema } from "@google-labs/breadboard";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { idFromPath, isParticleMode } from "./common.js";
import { EphemeralParticleTree } from "./types.js";
import { Signal } from "signal-polyfill";

export { ReactiveAppScreen };

const now = new Signal.State(performance.now());

setInterval(() => now.set(performance.now()), 1000);

class ReactiveAppScreen implements AppScreen {
  @signal
  accessor status: "processing" | "interactive" | "complete" = "processing";

  @signal
  accessor type: "progress" | "input" | "a2ui" = "progress";

  @signal
  get last() {
    return Array.from(this.outputs.values()).at(-1) || null;
  }

  @signal
  accessor progress: string | undefined;

  @signal
  accessor #expectedDuration: number = -1;

  @signal
  accessor #lastSetDurationTimestamp: number = -1;

  get expectedDuration() {
    return this.#expectedDuration;
  }

  set expectedDuration(value: number) {
    if (value === -1) {
      this.#lastSetDurationTimestamp = -1;
    } else {
      this.#lastSetDurationTimestamp = performance.now();
    }
    this.#expectedDuration = value;
  }

  @signal
  get progressCompletion() {
    if (this.#lastSetDurationTimestamp === -1) return -1;

    const fraction =
      (now.get() - this.#lastSetDurationTimestamp) /
      (this.#expectedDuration * 1000);

    return Math.floor(getElasticProgress(fraction) * 100);
  }

  outputs: Map<string, AppScreenOutput> = new SignalMap();

  #outputSchema: Schema | undefined;

  constructor(
    public readonly title: string,
    outputSchema: Schema | undefined
  ) {
    this.#outputSchema = outputSchema;
  }

  /**
   * Adds an output to the screen. These are the bubbled outputs, typically
   * part of the user input interaction, and much more in the Particle
   * future.
   */
  addOutput(data: OutputResponse, _particleTree: EphemeralParticleTree | null) {
    const { node, outputs, path } = data;
    const { configuration = {} } = node;
    const { schema: s = {} } = configuration;

    const schema = s as Schema;

    // For now, don't render particle streams: these only go to Console view.
    if (isParticleMode(schema, outputs)) return;

    this.outputs.set(idFromPath(path), {
      schema,
      output: outputs,
    });
  }

  /**
   * Marks this screen as "input" screen.
   */
  markAsInput(): void {
    this.type = "input";
  }

  finalize(data: NodeEndResponse) {
    const { outputs, path } = data;
    this.outputs.set(idFromPath(path), {
      output: outputs,
      schema: this.#outputSchema,
    });
    this.status = "complete";
  }
}

/**
 * Calculates an elastic progress value that becomes asymptotically slower
 * after a certain threshold ('knee'), ensuring it never reaches 1.0.
 *
 * @param rawFraction - The actual linear progress (time elapsed / expected duration).
 * @param knee - The point (0.0 - 1.0) where linear progress ends and elasticity begins. Default 0.75.
 * @param stretch - How "sticky" the final stretch is. Higher = faster initial approach to 99%. Default 5.0.
 */
export function getElasticProgress(
  rawFraction: number,
  knee: number = 0.75,
  stretch: number = 5.0
): number {
  if (rawFraction <= knee) {
    // Linear phase: returns exact progress up to the knee.
    return rawFraction;
  }

  // Elastic phase: Map infinite remaining time into the remaining UI space.
  // We calculate how far past the knee we are.
  const overtime = rawFraction - knee;
  // We calculate how much UI space is left (e.g., the final 25%).
  const remainingUI = 1.0 - knee;

  // Exponential decay formula to asymptotically approach 1.0
  return 1.0 - remainingUI * Math.exp(-overtime * stretch);
}
