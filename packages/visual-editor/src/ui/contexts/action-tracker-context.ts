/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { ActionTracker } from "../../sca/types.js";

export const actionTrackerContext = createContext<ActionTracker | undefined>(
  "action-tracker"
);
