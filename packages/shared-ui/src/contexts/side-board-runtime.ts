/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { SideBoardRuntime } from "../sideboards/types";

export const sideBoardRuntime = createContext<SideBoardRuntime | undefined>(
  "bb-side-board-runtime"
);
