/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import type { GlobalConfig } from "../../sca/types.js";

// Re-export GlobalConfig for backward compatibility.
// Canonical source: sca/types.ts.
export type { GlobalConfig };

export const globalConfigContext = createContext<GlobalConfig | undefined>(
  "bb-global-config"
);
