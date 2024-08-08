/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import type { SettingsHelper } from "../types/types.js";

export const settingsHelperContext =
  createContext<SettingsHelper>("bb-settings-helper");
