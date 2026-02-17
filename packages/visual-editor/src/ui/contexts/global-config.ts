/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-exported from SCA (canonical location)
export {
  type GlobalConfig,
  type GoogleDrivePermission,
  type BuildInfo,
} from "../../sca/types.js";

import { createContext } from "@lit/context";
import type { GlobalConfig } from "../../sca/types.js";

export const globalConfigContext = createContext<GlobalConfig | undefined>(
  "bb-global-config"
);
