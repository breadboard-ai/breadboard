/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { ReactiveAppScreen } from "./app-screen";
import { App, AppScreen, ProjectRun } from "./types";

export { ReactiveApp };

class ReactiveApp implements App {
  constructor(private readonly run: ProjectRun) {}

  @signal
  get state() {
    if (this.screens.size === 0) return "splash";
    if (this.run.error) return "error";
    if (this.run.input) return "input";
    if (this.current.size === 0) return "output";
    return "progress";
  }

  @signal
  get current(): ReadonlyMap<string, AppScreen> {
    return new Map(
      Array.from(this.screens.entries())
        .map(([id, screen]) =>
          screen.status === "interactive" ? [id, screen] : null
        )
        .filter(Boolean) as [string, AppScreen][]
    );
  }

  screens: Map<string, ReactiveAppScreen> = new SignalMap();

  @signal
  get last(): ReactiveAppScreen | null {
    return Array.from(this.screens.values()).at(-1) || null;
  }
}
