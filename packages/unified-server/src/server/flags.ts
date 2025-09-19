/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "node:fs/promises";

import {
  type ClientDeploymentConfiguration,
  type DomainConfiguration,
} from "@breadboard-ai/types/deployment-configuration.js";

export const ALLOW_3P_MODULES = getBoolean("ALLOW_3P_MODULES");

export const BACKEND_API_ENDPOINT: string = getString("BACKEND_API_ENDPOINT");

export const ENABLE_FORCE_2D_GRAPH = getBoolean("ENABLE_FORCE_2D_GRAPH");

export const ENABLE_GENERATE_FOR_EACH = getBoolean("ENABLE_GENERATE_FOR_EACH");

export const ENABLE_GOOGLE_FEEDBACK = getBoolean("ENABLE_GOOGLE_FEEDBACK");

export const ENABLE_MCP = getBoolean("ENABLE_MCP");

export const ENABLE_PLAN_RUNNER = getBoolean("ENABLE_PLAN_RUNNER");

export const ENABLE_SAVE_AS_CODE = getBoolean("ENABLE_SAVE_AS_CODE");

export const FEEDBACK_LINK = getString("FEEDBACK_LINK");

export const GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID: string = getString(
  "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID"
);

export const GOOGLE_FEEDBACK_BUCKET = getString("GOOGLE_FEEDBACK_BUCKET");

export const GOOGLE_FEEDBACK_PRODUCT_ID = getString(
  "GOOGLE_FEEDBACK_PRODUCT_ID"
);

export const MCP_SERVER_ALLOW_LIST: string[] = getStringList(
  "MCP_SERVER_ALLOW_LIST"
);

export const MEASUREMENT_ID = getString("MEASUREMENT_ID");

export const SERVER_URL: string = getString("SERVER_URL");

export async function getClientConfig(): Promise<ClientDeploymentConfiguration> {
  console.log("Loading config from environment");

  const domainConfig = await loadDomainConfig();

  return {
    MEASUREMENT_ID: MEASUREMENT_ID,
    BACKEND_API_ENDPOINT: BACKEND_API_ENDPOINT,
    FEEDBACK_LINK: FEEDBACK_LINK,
    ENABLE_GOOGLE_FEEDBACK: ENABLE_GOOGLE_FEEDBACK,
    GOOGLE_FEEDBACK_PRODUCT_ID: GOOGLE_FEEDBACK_PRODUCT_ID,
    GOOGLE_FEEDBACK_BUCKET: GOOGLE_FEEDBACK_BUCKET,
    ALLOW_3P_MODULES: ALLOW_3P_MODULES,
    domains: domainConfig,
    flags: {
      usePlanRunner: ENABLE_PLAN_RUNNER,
      saveAsCode: ENABLE_SAVE_AS_CODE,
      generateForEach: ENABLE_GENERATE_FOR_EACH,
      mcp: ENABLE_MCP,
      force2DGraph: ENABLE_FORCE_2D_GRAPH,
    },
  };
}

async function loadDomainConfig(): Promise<
  Record<string, DomainConfiguration>
> {
  const path = getString("DOMAIN_CONFIG_FILE");
  if (!path) {
    return {};
  }

  console.log(`Loading domain config from ${path}`);
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as Record<string, DomainConfiguration>;
}

/** Get the value of the given flag as a string, or empty string if absent. */
function getString(flagName: string): string {
  return process.env[flagName] ?? "";
}

/** Get the value of the given flag as a comma-delimited list of strings. */
function getStringList(flagName: string): string[] {
  return (
    getString(flagName)
      .split(",")
      // Filter out empty strings (e.g. if the env value is empty)
      .filter((x) => x)
  );
}

/**
 * Get the value of the given flag as a boolean.
 *
 * Anything other than the literal string "true" (case-insensitive) will be
 * interpreted as false
 */
function getBoolean(flagName: string): boolean {
  return getString(flagName).toLowerCase() === "true";
}
