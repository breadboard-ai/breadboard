/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlags } from "@breadboard-ai/types";

export const defaultRuntimeFlags: RuntimeFlags = {
  agentMode: false,
  consistentUI: false,
  enableDrivePickerInLiteMode: false,
  force2DGraph: false,
  googleOne: false,
  gulfRenderer: false,
  mcp: false,
  opalAdk: false,
  outputTemplates: false,
  requireConsentForGetWebpage: true,
  requireConsentForOpenWebpage: true,
  streamGenWebpage: false,
  streamPlanner: false,
  enableGoogleDriveTools: false,
  enableNotebookLm: false,
  enableResumeAgentRun: false,
  enableGraphEditorAgent: false,
};
