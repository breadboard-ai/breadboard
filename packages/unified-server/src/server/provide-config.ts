/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SecretsProvider } from "@breadboard-ai/board-server";
import {
  type ClientDeploymentConfiguration,
  type ServerDeploymentConfiguration,
} from "@breadboard-ai/types/deployment-configuration.js";

export { getConfigFromSecretManager };

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
