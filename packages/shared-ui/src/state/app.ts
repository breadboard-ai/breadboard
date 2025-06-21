/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { App, AppScreen } from "./types";
import { SignalMap } from "signal-utils/map";
import { ReactiveAppScreen } from "./app-screen";

export { ReactiveApp };

class ReactiveApp implements App {
  screens: Map<string, AppScreen> = new SignalMap();

  @signal
  accessor current: ReactiveAppScreen | null = null;
}
