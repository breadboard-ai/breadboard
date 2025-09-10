/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createSimpleMemoryClient,
  McpBuiltInClientFactory,
} from "@breadboard-ai/mcp";
import { createGoogleCalendarClient } from "@breadboard-ai/mcp-gcal";

export const builtInMcpClients: [string, McpBuiltInClientFactory][] = [
  ["memory", createSimpleMemoryClient],
  ["gcal", createGoogleCalendarClient],
];
