/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";

export const ALLOW_3P_MODULES: boolean = getBoolean("ALLOW_3P_MODULES");

export const BACKEND_API_ENDPOINT: string = getString("BACKEND_API_ENDPOINT");

export const DOMAIN_CONFIG_FILE: string = getString("DOMAIN_CONFIG_FILE");

export const ENABLE_FORCE_2D_GRAPH: boolean = getBoolean(
  "ENABLE_FORCE_2D_GRAPH"
);

export const ENABLE_GENERATE_FOR_EACH: boolean = getBoolean(
  "ENABLE_GENERATE_FOR_EACH"
);

export const ENABLE_GOOGLE_FEEDBACK: boolean = getBoolean(
  "ENABLE_GOOGLE_FEEDBACK"
);

export const ENABLE_GULF_RENDERER: boolean = getBoolean("ENABLE_GULF_RENDERER");

export const ENABLE_MCP: boolean = getBoolean("ENABLE_MCP");

export const ENABLE_PLAN_RUNNER: boolean = getBoolean("ENABLE_PLAN_RUNNER");

export const ENABLE_SAVE_AS_CODE: boolean = getBoolean("ENABLE_SAVE_AS_CODE");

export const FEEDBACK_LINK: string = getString("FEEDBACK_LINK");

export const GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID: string = getString(
  "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID"
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
