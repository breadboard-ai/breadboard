/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { bootstrap } from "./bootstrap";
import { loadKits, registerLegacyKits } from "./utils/kit-loader";

bootstrap({
  kits: loadKits(),
  graphStorePreloader: registerLegacyKits,
});
