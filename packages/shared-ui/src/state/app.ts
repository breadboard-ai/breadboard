/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { SignalArray } from "signal-utils/array";
import { ReactiveAppScreen } from "./app-screen";
import { ProjectRun } from "./types";
import {
  App,
  AppScreen,
  ConsentRequestWithCallback,
} from "@breadboard-ai/types";

export { ReactiveApp };

class ReactiveApp implements App {
  constructor(private readonly run: ProjectRun) {}

  /**
   * Consent requests that will be displayed in the app view
   */
  readonly consentRequests = new SignalArray<ConsentRequestWithCallback>();

  @signal
  get state() {
    if (this.consentRequests.length > 0) return "consent";
    if (this.screens.size === 0) return "splash";
    if (this.run.error) return "error";
    if (this.run.input) return "input";
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
    return Array.from(this.screens.values()).at(-1) || null;
  }
}
