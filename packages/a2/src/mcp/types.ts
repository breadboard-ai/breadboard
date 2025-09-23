/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type InitializeResponse = {
  capabilities: {
    resources?: JsonSerializable;
    tools?: JsonSerializable;
    prompts?: JsonSerializable;
  };
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
};

export type InitArguments = {
  /**
   * URL of the MCP server to connect to
   */
  url: string;
  /**
   * MCP Client Information
   */
  info: Implementation;
};

export type Implementation = {
  name: string;
  title: string;
  version: string;
};

export type ListToolsTool = {
  name: string;
  description: string;
  // Schema is Breadboard-specific, but this should work well enough
  inputSchema: Schema;
};

export type ListToolsResponse = {
  tools: ListToolsTool[];
};

export type CallToolRequest = {
  name: string;
  arguments: JsonSerializable;
};

export type CallToolContentText = {
  type: "text";
  text: string;
};

export type CallToolContentImage = {
  type: "image";
  data: string;
  mimeType: string;
};

export type CallToolContent = CallToolContentText | CallToolContentImage;

export type CallToolResponse = {
  content: CallToolContent[];
};

export type MCPResponse =
  | InitializeResponse
  | ListToolsResponse
  | CallToolResponse;

export type JsonRpcResponse<M extends MCPResponse> = {
  id: number;
  jsonrpc: "2.0";
  result: M;
};

export type ServerSentEvent<T extends JsonSerializable = JsonSerializable> = {
  data: T;
  event: string;
  id: string | null;
  retry: string | null;
};

export type SavedMessageEndpoint = {
  endpoint: string;
};
