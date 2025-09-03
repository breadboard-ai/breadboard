/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  CallToolRequest,
  CallToolResult,
  Implementation,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

export type JsonSerializableHeadersInit =
  | [string, string][]
  | Record<string, string>;

export type JsonSerializableRequestInit = {
  /** A BodyInit object or null to set request's body. */
  body?: string;
  /** A string indicating how the request will interact with the browser's cache to set request's cache. */
  cache?: RequestCache;
  /** A string indicating whether credentials will be sent with the request always, never, or only when sent to a same-origin URL. Sets request's credentials. */
  credentials?: RequestCredentials;
  /** A Headers object, an object literal, or an array of two-item arrays to set request's headers. */
  headers?: JsonSerializableHeadersInit;
  /** A cryptographic hash of the resource to be fetched by request. Sets request's integrity. */
  integrity?: string;
  /** A boolean to set request's keepalive. */
  keepalive?: boolean;
  /** A string to set request's method. */
  method?: string;
  /** A string to indicate whether the request will use CORS, or will be restricted to same-origin URLs. Sets request's mode. */
  mode?: RequestMode;
  priority?: RequestPriority;
  /** A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect. */
  redirect?: RequestRedirect;
  /** A string whose value is a same-origin URL, "about:client", or the empty string, to set request's referrer. */
  referrer?: string;
  /** A referrer policy to set request's referrerPolicy. */
  referrerPolicy?: ReferrerPolicy;
};

export type McpProxyRequest = {
  url: string;
  init: JsonSerializableRequestInit;
};

export type McpCallToolResult = { content: CallToolResult["content"] };
export type McpListToolResult = { tools: ListToolsResult["tools"] };

/**
 * An abstract type around MCP's Client, so that we could switch out the
 * actual client and use our own.
 */
export type McpClient = {
  connect(transport: Transport): Promise<void>;
  getServerVersion(): Implementation;
  close(): Promise<void>;
  callTool(params: CallToolRequest["params"]): Promise<McpCallToolResult>;
  listTools(): Promise<McpListToolResult>;
};
