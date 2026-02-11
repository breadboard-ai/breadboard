/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// An export for legacy runtime APIs: things that we need exposed
// but really don't want to in the long run

// Move to `invoke` (or something) package.
export { getHandler } from "./handler.js";
export { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
export { invokeMainDescriber } from "./sandbox/invoke-describer.js";
