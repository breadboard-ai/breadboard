/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { ReactiveAppScreen } from "./app-screen.js";
import { ProjectRun } from "./types.js";
import { App, AppScreen } from "@breadboard-ai/types";

export { ReactiveApp };

class ReactiveApp implements App {
  constructor(private readonly run: ProjectRun) {}

  @signal
  get state() {
    if (!this.last) return "splash";
    if (this.run.error) return "error";
    // Note: Input state is now handled by SCA
    if (this.current.size === 0) return "output";
    if (
      [...this.screens.values()].some(
        (screen) => screen.last?.a2ui && screen.status === "interactive"
      )
    ) {
      return "interactive";
    }
    return "progress";
  }

  @signal
  get current(): ReadonlyMap<string, AppScreen> {
    return new Map(
      Array.from(this.screens.entries())
        .map(([id, screen]) =>
          screen.status !== "complete" ? [id, screen] : null
        )
        .filter(Boolean) as [string, AppScreen][]
    );
  }

  screens: Map<string, ReactiveAppScreen> = new SignalMap();

  @signal
  get last(): ReactiveAppScreen | null {
    return (
      Array.from(this.screens.values()).findLast(
        (screen) => !(screen.type === "input" && screen.status === "complete")
      ) || null
    );
  }
}
