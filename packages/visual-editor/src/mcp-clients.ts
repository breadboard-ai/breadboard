/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createGdriveClient, McpBuiltInClientFactory } from "./mcp/index.js";
import { createGoogleCalendarClient } from "./mcp/index.js";
import { createGmailClient } from "./mcp/index.js";

export const builtInMcpClients: [string, McpBuiltInClientFactory][] = [
  ["gcal", createGoogleCalendarClient],
  ["gmail", createGmailClient],
  ["gdrive", createGdriveClient],
];
