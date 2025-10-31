/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as flags from "./flags.js";
import type { ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";

/**
 * Create the config object that will be embedded in the HTML payload and
 * passed to the client.
 */
export async function createClientConfig(opts: {
  OAUTH_CLIENT: string;
}): Promise<ClientDeploymentConfiguration> {
  return {
    ALLOWED_REDIRECT_ORIGINS: flags.ALLOWED_REDIRECT_ORIGINS,
    MEASUREMENT_ID: flags.MEASUREMENT_ID,
    BACKEND_API_ENDPOINT: flags.BACKEND_API_ENDPOINT,
    ENVIRONMENT_NAME: flags.ENVIRONMENT_NAME,
    GOOGLE_DRIVE_PUBLISH_PERMISSIONS: flags.GOOGLE_DRIVE_PUBLISH_PERMISSIONS,
    GOOGLE_DRIVE_USER_FOLDER_NAME: flags.GOOGLE_DRIVE_USER_FOLDER_NAME,
    GOOGLE_FEEDBACK_PRODUCT_ID: flags.GOOGLE_FEEDBACK_PRODUCT_ID,
    GOOGLE_FEEDBACK_BUCKET: flags.GOOGLE_FEEDBACK_BUCKET,
    ALLOW_3P_MODULES: flags.ALLOW_3P_MODULES,
    SURVEY_MODE: flags.SURVEY_MODE,
    SURVEY_API_KEY: flags.SURVEY_API_KEY,
    SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID:
      flags.SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID,
    OAUTH_CLIENT: opts.OAUTH_CLIENT,
    SHELL_GUEST_ORIGIN: flags.SHELL_GUEST_ORIGIN,
    SHELL_HOST_ORIGINS: flags.SHELL_HOST_ORIGINS,
    domains: flags.DOMAIN_CONFIG,
    flags: {
      generateForEach: flags.ENABLE_GENERATE_FOR_EACH,
      mcp: flags.ENABLE_MCP,
      force2DGraph: flags.ENABLE_FORCE_2D_GRAPH,
      gulfRenderer: flags.ENABLE_GULF_RENDERER,
      consistentUI: false,
      agentMode: false,
      autoTheme: false,
    },
  };
}
