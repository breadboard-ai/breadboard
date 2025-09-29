/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createFileSystemClient,
  createGdriveClient,
  McpBuiltInClientFactory,
} from "@breadboard-ai/mcp";
import { createGoogleCalendarClient } from "@breadboard-ai/mcp";
import { createGmailClient } from "@breadboard-ai/mcp";

export const builtInMcpClients: [string, McpBuiltInClientFactory][] = [
  ["gcal", createGoogleCalendarClient],
  ["gmail", createGmailClient],
  ["gdrive", createGdriveClient],
  ["filesystem", createFileSystemClient],
];
