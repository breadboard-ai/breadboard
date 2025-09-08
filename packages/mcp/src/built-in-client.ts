/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolRequest,
  Implementation,
  ServerNotification,
  ServerRequest,
  Tool,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import z, { AnyZodObject, ZodRawShape } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  McpCallToolResult,
  McpClient,
  McpListToolResult,
  McpServerInfo,
} from "./types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export { BuiltInClient };

type ToolDeclaration = {
  info: Tool;
  inputZodSchema?: AnyZodObject;
  outputZodSchema?: AnyZodObject;
  callback: ToolCallback<undefined | ZodRawShape>;
};

type BuiltInClientArgs = {
  /**
   * Name of the MCP server (until we have getServerVersion working)
   */
  readonly name: string;
  /**
   * URL of the MCP server
   */
  readonly url: string;
};

// We don't use Extra in the McpClient current, so we just pass a dummy along.
const DUMMY_EXTRA = {} as unknown as RequestHandlerExtra<
  ServerRequest,
  ServerNotification
>;

class BuiltInClient implements McpClient {
  toolDeclarations: Map<string, ToolDeclaration> = new Map();

  constructor(public readonly args: BuiltInClientArgs) {}

  get info(): McpServerInfo {
    return {
      url: this.args.url,
      title: this.args.name,
      tools: this.tools,
    };
  }

  get tools(): Tool[] {
    return [...this.toolDeclarations.values()].map(
      (declaration) => declaration.info
    );
  }

  async connect(): Promise<void> {
    // No-op for built-in client
  }

  getServerVersion(): Implementation {
    return {
      name: this.args.name,
      version: "0.0.1",
    };
  }

  async close(): Promise<void> {
    // No-op for built-in client
  }

  async callTool(
    params: CallToolRequest["params"]
  ): Promise<McpCallToolResult> {
    const tool = this.toolDeclarations.get(params.name);
    if (!tool) {
      throw new Error(`Unknown tool name "${params.name}"`);
    }
    const inputSchema = tool.inputZodSchema;
    if (inputSchema) {
      const parseResult = await inputSchema.safeParseAsync(params.arguments);
      if (!parseResult.success) {
        throw new Error(
          `Invalid arguments for tool ${params.name}: ${parseResult.error.message}`
        );
      }
      const args = parseResult.data;
      const callback = tool.callback as ToolCallback<ZodRawShape>;
      return callback(args, DUMMY_EXTRA);
    } else {
      const callback = tool.callback as ToolCallback<undefined>;
      return callback(DUMMY_EXTRA);
    }
  }

  async listTools(): Promise<McpListToolResult> {
    return { tools: this.tools };
  }

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
  ) {
    this.toolDeclarations.set(name, {
      info: {
        name,
        title: config.title,
        description: config.description,
        inputSchema: toSchema(config.inputSchema) as Tool["inputSchema"],
        outputSchema: toSchema(config.outputSchema) as Tool["outputSchema"],
        annotations: config.annotations,
      },
      inputZodSchema: config.inputSchema
        ? z.object(config.inputSchema)
        : undefined,
      outputZodSchema: config.outputSchema
        ? z.object(config.outputSchema)
        : undefined,
      callback,
    });

    function toSchema<T>(t: T | undefined) {
      return t
        ? zodToJsonSchema(z.object(t), { strictUnions: true })
        : { type: "object", properties: {} };
    }
  }
}
