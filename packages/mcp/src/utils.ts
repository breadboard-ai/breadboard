/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export { mcpErr, mcpText, mcpResourceLink };

function mcpErr(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function mcpText(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

function mcpResourceLink(
  name: string,
  uri: string,
  mimeType: string
): CallToolResult {
  return {
    content: [{ type: "resource_link", name, uri, mimeType }],
  };
}
