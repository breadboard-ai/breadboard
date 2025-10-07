/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import {
  FileSystem,
  FunctionResponseCapabilityPart,
  Outcome,
} from "@breadboard-ai/types";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  CallToolRequest,
  CallToolResult,
  Implementation,
  ListToolsResult,
  Tool,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type z from "zod";

export type TokenGetter = (scopes?: OAuthScope[]) => Promise<Outcome<string>>;

export type CallToolResultContent = CallToolResult["content"];

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

export type McpCallToolResult =
  | {
      content: CallToolResult["content"];
      isError?: boolean;
      saveOutputs?: boolean;
    }
  | FunctionResponseCapabilityPart;
export type McpListToolResult = { tools: ListToolsResult["tools"] };

export type McpServerInfo = {
  /**
   * URL of the server.
   */
  url: string;
  /**
   * Friendly title of the server.
   */
  title: string;
  /**
   * If applicable, authentication token of the server.
   * This token will be inserted as `Authorization: Bearer ${token}` header
   * when making requests to the server.
   */
  authToken?: string;
  /**
   * Description of the server.
   */
  description?: string;
  /**
   * Icon of the server, if applicable.
   */
  icon?: string;
  /**
   * Cached list of tools that the server provides.
   */
  tools?: McpListToolResult["tools"];
  /**
   * Timestamp of when the tool list was last retrieved.
   */
  toolsRetrievedOn?: Date;
};

/**
 * An abstract type around MCP's Client, so that we could switch out the
 * actual client and use our own.
 */
export type McpClient = {
  connect(transport: Transport): Promise<void>;
  getServerVersion(): Implementation;
  close(): Promise<void>;
  callTool(
    params: CallToolRequest["params"]
  ): Promise<Outcome<McpCallToolResult>>;
  listTools(): Promise<McpListToolResult>;
};

export type McpServerStore = {
  add(info: McpServerInfo): Promise<Outcome<void>>;

  updateTools(
    url: string,
    tools: McpListToolResult["tools"]
  ): Promise<Outcome<void>>;

  remove(url: string): Promise<Outcome<void>>;

  get(url: string): Promise<McpServerInfo | undefined>;

  list(): Promise<Outcome<McpServerInfo[]>>;
};

export interface McpBuiltInClient extends McpClient {
  info: McpServerInfo;
  tools: Tool[];
  addTool<InputArgs extends z.ZodRawShape, OutputArgs extends z.ZodRawShape>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations?: ToolAnnotations;
    },
    callback: ToolCallback<InputArgs>
  ): void;
}

export type McpBuiltInClientFactoryContext = {
  tokenGetter: TokenGetter;
  fileSystem: FileSystem;
};

export type McpBuiltInClientFactory = (
  context: McpBuiltInClientFactoryContext
) => McpBuiltInClient;
