/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, NodeEndResponse } from "@breadboard-ai/types";
import { AppScreen } from "./types";
import { SignalMap } from "signal-utils/map";
import { Schema } from "@google-labs/breadboard";
import { idFromPath, toLLMContentArray } from "./common";
import { signal } from "signal-utils";

export { ReactiveAppScreen };

class ReactiveAppScreen implements AppScreen {
  id: string;

  @signal
  accessor status: "interactive" | "complete" = "interactive";

  @signal
  accessor type: "progress" | "input" = "progress";

  output: Map<string, LLMContent> = new SignalMap();

  #outputSchema: Schema | undefined;

  constructor(path: number[], outputSchema: Schema | undefined) {
    this.#outputSchema = outputSchema;
    this.id = idFromPath(path);
  }

  /**
   * Marks this screen as "input" screen.
   */
  markAsInput(): void {
    this.type = "input";
  }

  finalize(data: NodeEndResponse) {
    const { outputs } = data;
    const { products } = toLLMContentArray(this.#outputSchema || {}, outputs);
    for (const [name, product] of Object.entries(products)) {
      this.output.set(name, product);
    }
    this.status = "complete";
  }
}
