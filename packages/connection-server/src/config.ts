/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OAuthClientSecretData } from "./secrets.js";

export interface Config {
  secrets: Map<string, OAuthClientSecretData>;
}
