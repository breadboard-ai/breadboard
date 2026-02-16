/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "./ui/config/client-deployment-configuration.js";
import { bootstrap } from "./bootstrap.js";

const deploymentConfiguration = CLIENT_DEPLOYMENT_CONFIG;

bootstrap({
  deploymentConfiguration,
});
