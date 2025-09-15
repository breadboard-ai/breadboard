/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { ReactiveAppScreen } from "./app-screen";
import { App } from "./types";

export { ReactiveApp };

class ReactiveApp implements App {
  @signal
  get state() {
    return this.screens.size > 0 ? "screen" : "splash";
  }

  screens: Map<string, ReactiveAppScreen> = new SignalMap();

  @signal
  get last(): ReactiveAppScreen | null {
    return Array.from(this.screens.values()).at(-1) || null;
  }
}
