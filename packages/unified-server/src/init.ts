/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { bootstrap } from "@breadboard-ai/visual-editor/bootstrap";
import { asRuntimeKit, baseURLFromContext, err } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { isA2 } from "@breadboard-ai/a2";
import { JsonSerializable, LLMContent } from "@breadboard-ai/types";

import { Handler } from "@breadboard-ai/embed";
import { discoverClientDeploymentConfiguration } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { initializeAnalytics } from "@breadboard-ai/shared-ui/utils/action-tracker";
import { parseUrl } from "@breadboard-ai/shared-ui/utils/urls.js";

const deploymentConfiguration = discoverClientDeploymentConfiguration();

if (!deploymentConfiguration.BACKEND_API_ENDPOINT) {
  throw new Error(`No BACKEND_API_ENDPOINT was configured`);
}
const executeStepEndpoint: string = new URL(
  "v1beta1/executeStep",
  deploymentConfiguration.BACKEND_API_ENDPOINT
).href;

if (deploymentConfiguration?.MEASUREMENT_ID) {
  initializeAnalytics(deploymentConfiguration.MEASUREMENT_ID, true);
}

const url = parseUrl(window.location.href);
bootstrap({
  deploymentConfiguration,
  connectionServerUrl: new URL("/connection/", window.location.href),
  signinMode:
    url.dev?.["enable-new-signed-out-experience"] !== undefined
      ? "incremental"
      : "required",
  kits: [asRuntimeKit(Core)],
  defaultBoardService: "/board/",
  moduleInvocationFilter: (context) => {
    // If we allow 3P modules to run, we can exit quickly (no filter)
    if (deploymentConfiguration.ALLOW_3P_MODULES) return;
    const url = baseURLFromContext(context);
    // Allow sideboards
    if (url.hostname === "sideboard") return;
    // Disallow anything but A2.
    if (!isA2(url)) {
      return err(`This module is not allowed to run in this configuration`);
    }
  },
  // Keep this in sync with `packages/unified-server/src/client/app/utils/run-config.ts`
  env: [
    {
      path: "/env/settings/backend",
      data: toLLMContent({ endpoint_url: executeStepEndpoint }),
    },
  ],
  embedHandler: window.self !== window.top ? new Handler() : undefined,
});

function toLLMContent(json: JsonSerializable): LLMContent[] {
  return [{ parts: [{ json }] }];
}
