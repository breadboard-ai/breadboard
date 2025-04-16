/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { bootstrap } from "@breadboard-ai/visual-editor/bootstrap";

bootstrap({
  boardServerUrl: new URL('drive:'), // new URL("/board/", window.location.href),
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
});
