/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuiltInClient, McpBuiltInClient } from "@breadboard-ai/mcp";
import { TokenGetter } from "@breadboard-ai/types";

export { createGoogleCalendarClient };

function createGoogleCalendarClient(
  _tokenGetter: TokenGetter
): McpBuiltInClient {
  return new BuiltInClient({
    name: "Google Calendar",
    url: "builtin:gcal",
  });
}
