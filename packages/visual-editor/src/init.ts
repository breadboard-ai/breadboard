/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { bootstrap } from "./bootstrap";

bootstrap({
  kits: [],
  graphStorePreloader: () => {},
  deploymentConfiguration: CLIENT_DEPLOYMENT_CONFIG,
});
