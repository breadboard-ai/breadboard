/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { bootstrap } from "@breadboard-ai/visual-editor/bootstrap";
import { asRuntimeKit } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";

bootstrap({
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
  kits: [asRuntimeKit(Core)],
});
