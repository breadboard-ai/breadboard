/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppScreen, AppScreenOutput } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { A2UIClient } from "./client";

export { A2UIAppScreen };

class A2UIAppScreen implements AppScreen {
  @signal
  get status(): "interactive" | "complete" {
    return this.awaitUserInput ? "interactive" : "complete";
  }

  @signal
  accessor type: "progress" | "input" = "progress";

  outputs: Map<string, AppScreenOutput> = new Map();

  last: AppScreenOutput;

  @signal
  accessor awaitUserInput: boolean = false;

  constructor(
    private readonly client: A2UIClient,
    public readonly title: string
  ) {
    this.last = {
      schema: undefined,
      output: {},
      a2ui: client,
    };
  }
}
