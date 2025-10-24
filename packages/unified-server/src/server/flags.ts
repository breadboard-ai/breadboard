/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";

import type {
  DomainConfiguration,
  GoogleDrivePermission,
} from "@breadboard-ai/types/deployment-configuration.js";

export const ALLOW_3P_MODULES: boolean = getBoolean("ALLOW_3P_MODULES");

export const ALLOWED_REDIRECT_ORIGINS: string[] = getStringList(
  "ALLOWED_REDIRECT_ORIGINS"
);

export const BACKEND_API_ENDPOINT: string = getString("BACKEND_API_ENDPOINT");

export const DOMAIN_CONFIG: Record<string, DomainConfiguration> =
  getDomainConfig("DOMAIN_CONFIG");

export const ENABLE_FORCE_2D_GRAPH: boolean = getBoolean(
  "ENABLE_FORCE_2D_GRAPH"
);

export const ENABLE_GENERATE_FOR_EACH: boolean = getBoolean(
  "ENABLE_GENERATE_FOR_EACH"
);

export const ENABLE_GULF_RENDERER: boolean = getBoolean("ENABLE_GULF_RENDERER");

export const ENABLE_MCP: boolean = getBoolean("ENABLE_MCP");

export const ENVIRONMENT_NAME: string = getString("ENVIRONMENT_NAME");

export const GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID: string = getString(
  "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID"
);

export const GOOGLE_DRIVE_PUBLISH_PERMISSIONS: GoogleDrivePermission[] =
  getDrivePermissions("GOOGLE_DRIVE_PUBLISH_PERMISSIONS");

export const GOOGLE_DRIVE_USER_FOLDER_NAME: string = getString(
  "GOOGLE_DRIVE_USER_FOLDER_NAME"
);

export const GOOGLE_FEEDBACK_BUCKET: string = getString(
  "GOOGLE_FEEDBACK_BUCKET"
);

export const GOOGLE_FEEDBACK_PRODUCT_ID: string = getString(
  "GOOGLE_FEEDBACK_PRODUCT_ID"
);

export const MCP_SERVER_ALLOW_LIST: string[] = getStringList(
  "MCP_SERVER_ALLOW_LIST"
);

export const MEASUREMENT_ID: string = getString("MEASUREMENT_ID");

export const SERVER_URL: string = getString("SERVER_URL");

export const SURVEY_MODE = getSurveyMode("SURVEY_MODE");

export const SURVEY_API_KEY = getString("SURVEY_API_KEY");

export const SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID = getString(
  "SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID"
);

export const SHELL_GUEST_ORIGIN = getString("SHELL_GUEST_ORIGIN");

export const SHELL_HOST_ORIGINS = getStringList("SHELL_HOST_ORIGINS");

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

function getDrivePermissions(flagName: string): GoogleDrivePermission[] {
  const permissions = getString(flagName);
  if (!permissions) {
    return [];
  }

  console.log(
    `[unified-server startup] Parsing Drive permissions from ${flagName}`
  );
  return JSON.parse(permissions) as GoogleDrivePermission[];
}

function getDomainConfig(
  flagName: string
): Record<string, DomainConfiguration> {
  const domainConfig = getString(flagName);
  if (!domainConfig) {
    return {};
  }

  console.log(
    `[unified-server startup] Parsing domain config from ${flagName}`
  );
  return parseDomainConfig(domainConfig);
}

export function parseDomainConfig(domainConfig: string) {
  return JSON.parse(domainConfig) as Record<string, DomainConfiguration>;
}

function getSurveyMode(flagName: string): "on" | "off" | "test" {
  const value = getString(flagName).toLowerCase();
  if (value === "on" || value === "off" || value === "test") {
    return value;
  }
  if (!value) {
    return "off";
  }
  throw new Error(`Invalid survey mode ${value}`);
}
