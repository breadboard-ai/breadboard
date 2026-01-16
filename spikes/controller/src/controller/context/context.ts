/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type Controller } from "../controller.js";

export const controllerContext = createContext<Controller | undefined>(
  "Controller"
);
