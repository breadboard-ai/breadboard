/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type AppController } from "../controller.js";

export const appControllerContext = createContext<AppController | undefined>(
  "AppController"
);
