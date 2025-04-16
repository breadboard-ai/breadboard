/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { bootstrap } from "@breadboard-ai/visual-editor/bootstrap";

bootstrap({
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
});
