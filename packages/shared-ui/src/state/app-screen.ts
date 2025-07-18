/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeEndResponse } from "@breadboard-ai/types";
import { OutputResponse, Schema } from "@google-labs/breadboard";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { idFromPath, isParticleMode } from "./common";
import { AppScreen, AppScreenOutput, EphemeralParticleTree } from "./types";

export { ReactiveAppScreen };

class ReactiveAppScreen implements AppScreen {
  id: string;

  @signal
  accessor status: "interactive" | "complete" = "interactive";

  @signal
  accessor type: "progress" | "input" = "progress";

  @signal
  get last() {
    return Array.from(this.outputs.values()).at(-1) || null;
  }

  outputs: Map<string, AppScreenOutput> = new SignalMap();

  #outputSchema: Schema | undefined;

  constructor(
    public readonly title: string,
    path: number[],
    outputSchema: Schema | undefined
  ) {
    this.#outputSchema = outputSchema;
    this.id = idFromPath(path);
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
