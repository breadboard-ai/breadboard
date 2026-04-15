/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { bind } from "./theme-actions.js";

export function onThemeChange(): SignalTrigger {
  return signalTrigger("Theme Change", () => {
    const { controller } = bind;
    return controller.theme.mode;
  });
}
