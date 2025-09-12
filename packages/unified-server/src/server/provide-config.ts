/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "node:fs/promises";

import { SecretsProvider } from "@breadboard-ai/board-server";
import {
  type ClientDeploymentConfiguration,
  type ServerDeploymentConfiguration,
  type DomainConfiguration,
} from "@breadboard-ai/types/deployment-configuration.js";

export type SecretValueFormat = {
  client: ClientDeploymentConfiguration;
  server: ServerDeploymentConfiguration;
};

export type DeploymentConfiguration = {
  client: ClientDeploymentConfiguration;
  server: ServerDeploymentConfiguration;
};

const DEFAULT_VALUE: DeploymentConfiguration = {
  client: {} as ClientDeploymentConfiguration,
  server: {},
} as const;

export async function getConfig(): Promise<DeploymentConfiguration> {
  if (!getBoolean("ENABLE_ENVIRONMENT_CONFIG")) {
    return getConfigFromSecretManager();
  }

  console.log("Loading config from environment");

  const domainConfig = await loadDomainConfig();

  const clientConfig: ClientDeploymentConfiguration = {
    MEASUREMENT_ID: getString("MEASUREMENT_ID"),
    BACKEND_API_ENDPOINT: getString("BACKEND_API_ENDPOINT"),
    FEEDBACK_LINK: getString("FEEDBACK_LINK"),
    ENABLE_GOOGLE_FEEDBACK: getBoolean("ENABLE_GOOGLE_FEEDBACK"),
    GOOGLE_FEEDBACK_PRODUCT_ID: getString("GOOGLE_FEEDBACK_PRODUCT_ID"),
    GOOGLE_FEEDBACK_BUCKET: getString("GOOGLE_FEEDBACK_BUCKET"),
    ALLOW_3P_MODULES: getBoolean("ALLOW_3P_MODULES"),
    domains: domainConfig,
    flags: {
      usePlanRunner: getBoolean("ENABLE_PLAN_RUNNER"),
      saveAsCode: getBoolean("ENABLE_SAVE_AS_CODE"),
      generateForEach: getBoolean("ENABLE_GENERATE_FOR_EACH"),
      mcp: getBoolean("ENABLE_MCP"),
      force2DGraph: getBoolean("ENABLE_FORCE_2D_GRAPH"),
    },
  };

  const serverConfig: ServerDeploymentConfiguration = {
    BACKEND_API_ENDPOINT: getString("BACKEND_API_ENDPOINT"),
    SERVER_URL: getString("SERVER_URL"),
    GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID: getString(
      "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID"
    ),
    MCP_SERVER_ALLOW_LIST: getStringList("MCP_SERVER_ALLOW_LIST"),
  };

  return { client: clientConfig, server: serverConfig };
}

async function loadDomainConfig(): Promise<
  Record<string, DomainConfiguration>
> {
  const path = getString("DOMAIN_CONFIG_FILE");
  if (!path) {
    return {};
  }

  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as Record<string, DomainConfiguration>;
}

async function getConfigFromSecretManager(): Promise<DeploymentConfiguration> {
  console.log("Loading config from secret manager");
  try {
    const secretValue = (
      await SecretsProvider.instance().getKey("CONFIG")
    )?.[1];
    if (!secretValue) {
      console.warn("Unable to read configuration from secret");
      return DEFAULT_VALUE;
    }

    const config = JSON.parse(secretValue) as SecretValueFormat;

    return { client: config.client, server: config.server };
  } catch (e) {
    console.warn("Error parsing configuration", (e as Error).message);
    return DEFAULT_VALUE;
  }
}

/** Gets the value of the given flag as a string, or empty string if absent. */
function getString(flagName: string): string {
  return process.env[flagName] ?? "";
}

/** Gets the value of the given flag as a comma-delimited list of strings. */
function getStringList(flagName: string): string[] {
  return (
    getString(flagName)
      .split(",")
      // Filter out empty strings (e.g. if the env value is empty)
      .filter((x) => x)
  );
}

/**
 * Gets the value of the given flag as a boolean.
 *
 * Anything other than the literal string "true" (case-insensitive) will be
 * interpreted as false
 */
function getBoolean(flagName: string): boolean {
  return getString(flagName).toLowerCase() === "true";
}
