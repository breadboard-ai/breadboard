/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretsProvider } from "@breadboard-ai/board-server";
import { type ClientDeploymentConfiguration } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";

export { getConfigFromSecretManager };

/**
 * Server-specific variables of deployment configuration. These values
 * are only available to the server. To add a new value:
 * 1. Add it here
 * 2. Consume it in `./main.ts`
 */
export type ServerDeploymentConfiguration = {
  BACKEND_API_ENDPOINT?: string;
};

export type SecretValueFormat = {
  client: ClientDeploymentConfiguration;
  server: ServerDeploymentConfiguration;
};

export type DeploymentConfiguration = {
  /**
   * Stringified value of `ClientDeploymentConfiguration`.
   */
  client: string;
  /**
   * This is the server configuration.
   */
  server: ServerDeploymentConfiguration;
};

const DEFAULT_VALUE: DeploymentConfiguration = {
  client: "",
  server: {},
} as const;

async function getConfigFromSecretManager(): Promise<DeploymentConfiguration> {
  try {
    const secretValue = (
      await SecretsProvider.instance().getKey("CONFIG")
    )?.[1];
    if (!secretValue) {
      console.warn("Unable to read configuration from secret");
      return DEFAULT_VALUE;
    }

    const config = JSON.parse(secretValue) as SecretValueFormat;

    const client = JSON.stringify(config.client).replaceAll(
      "</script>",
      "\x3C/script>"
    );
    return { client, server: config.server };
  } catch (e) {
    console.warn("Error parsing configuration", (e as Error).message);
    return DEFAULT_VALUE;
  }
}
