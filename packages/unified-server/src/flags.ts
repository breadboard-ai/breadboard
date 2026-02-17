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

import {
  getString,
  getStringList,
  getBoolean,
  getJson,
  getSecret,
} from "./flag-utils.js";

export { parseDomainConfig };

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

export const ENABLE_SHARING_2: boolean = getBoolean("ENABLE_SHARING_2");

export const ENABLE_STREAM_GEN_WEBPAGE: boolean = getBoolean(
  "ENABLE_STREAM_GEN_WEBPAGE"
);

export const ENABLE_AGENT_MODE: boolean = getBoolean("ENABLE_AGENT_MODE");

export const STREAM_PLANNER: boolean = getBoolean("ENABLE_STREAM_PLANNER");

export const OBSERVE_SYSTEM_THEME = getBoolean("OBSERVE_SYSTEM_THEME");

export const ENABLE_CONSISTENT_UI: boolean = getBoolean("ENABLE_CONSISTENT_UI");

export const ENABLE_MCP: boolean = getBoolean("ENABLE_MCP");

export const ENVIRONMENT_NAME: string = getString("ENVIRONMENT_NAME");

export const GOOGLE_OAUTH_AUTH_ENDPOINT: string = getString(
  "GOOGLE_OAUTH_AUTH_ENDPOINT"
);

export const GOOGLE_OAUTH_TOKEN_ENDPOINT: string = getString(
  "GOOGLE_OAUTH_TOKEN_ENDPOINT"
);

export const GOOGLE_DOCS_API_ENDPOINT: string = getString(
  "GOOGLE_DOCS_API_ENDPOINT"
);

export const GOOGLE_SHEETS_API_ENDPOINT: string = getString(
  "GOOGLE_SHEETS_API_ENDPOINT"
);

export const GOOGLE_SLIDES_API_ENDPOINT: string = getString(
  "GOOGLE_SLIDES_API_ENDPOINT"
);

export const GOOGLE_DRIVE_API_ENDPOINT: string = getString(
  "GOOGLE_DRIVE_API_ENDPOINT"
);

export const GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID: string = getString(
  "GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID"
);

export const GOOGLE_DRIVE_PUBLISH_PERMISSIONS =
  (getJson("GOOGLE_DRIVE_PUBLISH_PERMISSIONS") as GoogleDrivePermission[]) ??
  [];

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

export const SURVEY_API_KEY = getSecret("SURVEY_API_KEY");

export const SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID = getString(
  "SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID"
);

export const SHELL_GUEST_ORIGIN = getString("SHELL_GUEST_ORIGIN");

export const SHELL_HOST_ORIGINS = getStringList("SHELL_HOST_ORIGINS");

export const SHELL_PREFIX = getString("SHELL_PREFIX");

export const ENABLE_EMAIL_OPT_IN = getBoolean("ENABLE_EMAIL_OPT_IN");

export const ENABLE_OPAL_ADK = getBoolean("ENABLE_OPAL_ADK");

export const ENABLE_OUTPUT_TEMPLATES = getBoolean("ENABLE_OUTPUT_TEMPLATES");

export const ENABLE_GOOGLE_ONE = getBoolean("ENABLE_GOOGLE_ONE");
export const ENABLE_REQUIRE_CONSENT_FOR_GET_WEBPAGE = getBoolean(
  "ENABLE_REQUIRE_CONSENT_FOR_GET_WEBPAGE"
);

export const ENABLE_REQUIRE_CONSENT_FOR_OPEN_WEBPAGE = getBoolean(
  "ENABLE_REQUIRE_CONSENT_FOR_OPEN_WEBPAGE"
);

export const ENABLE_NEW_URL_SCHEME = getBoolean("ENABLE_NEW_URL_SCHEME");

export const SHARE_SURFACE_URL_TEMPLATES =
  (getJson("SHARE_SURFACE_URL_TEMPLATES") as Record<string, string>) ?? {};

export const ENABLE_DRIVE_PICKER_IN_LITE_MODE = getBoolean(
  "ENABLE_DRIVE_PICKER_IN_LITE_MODE"
);

export const ENABLE_GOOGLE_DRIVE_TOOLS = getBoolean(
  "ENABLE_GOOGLE_DRIVE_TOOLS"
);

export const ENABLE_RESUME_AGENT_RUN = getBoolean("ENABLE_RESUME_AGENT_RUN");

export const ENABLE_NOTEBOOK_LM = getBoolean("ENABLE_NOTEBOOK_LM");

export const ENABLE_GRAPH_EDITOR_AGENT = getBoolean(
  "ENABLE_GRAPH_EDITOR_AGENT"
);

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

function parseDomainConfig(domainConfig: string) {
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
