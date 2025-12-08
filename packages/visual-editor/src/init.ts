/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "./ui/config/client-deployment-configuration.js";
import { bootstrap } from "./bootstrap.js";
import { initializeAnalytics } from "./ui/utils/action-tracker.js";
import {
  OPAL_BACKEND_API_PREFIX,
  type JsonSerializable,
  type LLMContent,
} from "@breadboard-ai/types";

const deploymentConfiguration = CLIENT_DEPLOYMENT_CONFIG;

const executeStepEndpoint: string = new URL(
  "v1beta1/executeStep",
  OPAL_BACKEND_API_PREFIX
).href;

if (deploymentConfiguration?.MEASUREMENT_ID) {
  initializeAnalytics(deploymentConfiguration.MEASUREMENT_ID, true);
}

bootstrap({
  deploymentConfiguration,
  env: [
    {
      path: "/env/settings/backend",
      data: toLLMContent({ endpoint_url: executeStepEndpoint }),
    },
  ],
});

function toLLMContent(json: JsonSerializable): LLMContent[] {
  // test
  return [{ parts: [{ json }] }];
}
