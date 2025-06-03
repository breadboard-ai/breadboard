/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretsProvider } from "@breadboard-ai/board-server";

export { getConfigFromSecretManager };

async function getConfigFromSecretManager(): Promise<string> {
  try {
    const config = (await SecretsProvider.instance().getKey("CONFIG"))?.[1];
    if (!config) return "";
    return config.replaceAll("<script>", "\x3C/script>");
  } catch (e) {
    return "";
  }
}
