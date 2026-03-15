/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlags } from "@breadboard-ai/types";

export const defaultRuntimeFlags: RuntimeFlags = {
  consistentUI: false,
  force2DGraph: false,
  googleOne: false,
  mcp: false,
  opalAdk: false,
  outputTemplates: false,
  enableGoogleDriveTools: false,
  enableNotebookLm: false,
  enableResumeAgentRun: false,
  enableGraphEditorAgent: false,
  textEditorRemix: false,
  showTokenCounter: false,
  enableOpalBackend: false,
  enableSessionsBackend: false,
  enableSingletonPrefixCache: false,
};
