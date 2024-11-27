/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";

// TODO(aomarks) Switch to the provider which tracks loading state for signin.
// Also maybe secrets should be signals.
export interface SecretsProvider {
  getSecret(name: string): Promise<Result<string | undefined>>;
}
