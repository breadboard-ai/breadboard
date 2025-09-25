/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "node:fs/promises";
import * as flags from "./flags.js";
import {
  type ClientDeploymentConfiguration,
  type DomainConfiguration,
} from "@breadboard-ai/types/deployment-configuration.js";

/**
 * Create the config object that will be embedded in the HTML payload and
 * passed to the client.
 */
export async function createClientConfig(): Promise<ClientDeploymentConfiguration> {
  const domainConfig = await loadDomainConfig();
  return {
    MEASUREMENT_ID: flags.MEASUREMENT_ID,
    BACKEND_API_ENDPOINT: flags.BACKEND_API_ENDPOINT,
    FEEDBACK_LINK: flags.FEEDBACK_LINK,
    ENABLE_GOOGLE_FEEDBACK: flags.ENABLE_GOOGLE_FEEDBACK,
    GOOGLE_FEEDBACK_PRODUCT_ID: flags.GOOGLE_FEEDBACK_PRODUCT_ID,
    GOOGLE_FEEDBACK_BUCKET: flags.GOOGLE_FEEDBACK_BUCKET,
    ALLOW_3P_MODULES: flags.ALLOW_3P_MODULES,
    domains: domainConfig,
    flags: {
      usePlanRunner: flags.ENABLE_PLAN_RUNNER,
      saveAsCode: flags.ENABLE_SAVE_AS_CODE,
      generateForEach: flags.ENABLE_GENERATE_FOR_EACH,
      mcp: flags.ENABLE_MCP,
      force2DGraph: flags.ENABLE_FORCE_2D_GRAPH,
      gulfRenderer: flags.ENABLE_GULF_RENDERER,
    },
  };
}

async function loadDomainConfig(): Promise<
  Record<string, DomainConfiguration>
> {
  const path = flags.DOMAIN_CONFIG_FILE;
  if (!path) {
    return {};
  }

  console.log(`Loading domain config from ${path}`);
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as Record<string, DomainConfiguration>;
}
