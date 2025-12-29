/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import type {
  DescriberResult,
  DescriberResultTransformer,
  ExportDescriberResult,
  ToolOutput,
} from "./common.js";
import {
  type FunctionDeclaration,
  type GeminiSchema,
  type Tool,
} from "./gemini.js";
import { addUserTurn, ok } from "./utils.js";
import { err } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { McpToolAdapter } from "./mcp-tool-adapter.js";
import { ToolParamPart } from "./template.js";

export { ROUTE_TOOL_PATH };

const CODE_EXECUTION_SUFFIX = "#module:code-execution";

const ROUTE_TOOL_PATH = "control-flow/routing";

export type ToolHandle = {
  title?: string;
  tool: FunctionDeclaration;
  url: string;
  passContext: boolean;
  client?: McpToolAdapter;
  invoke?: (args: Record<string, unknown>) => Promise<Outcome<void>>;
};

export type CallToolsResult = {
  results: LLMContent[][];
  calledTools: boolean;
  calledCustomTools: boolean;
  saveOutputs: boolean;
};

export type ConnectorHandle = {
  tools: Map<string, ToolHandle>;
  configure?: [string, ToolHandle];
  load?: [string, ToolHandle];
};

export type ToolDescriptor =
  | string
  | {
      kind: "board";
      url: string;
    };

export type CallToolResult = {
  saveOutputs: boolean;
  results: LLMContent[];
};

export type SimplifiedToolManager = {
  callTool(part: FunctionCallCapabilityPart): Promise<Outcome<CallToolResult>>;
  list(): Tool[];
};

export { ToolManager };

class ToolManager implements SimplifiedToolManager {
  #hasSearch = false;
  #hasMaps = false;
  #hasCodeExection = false;
  tools: Map<string, ToolHandle> = new Map();
  errors: string[] = [];

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    private readonly describerResultTransformer?: DescriberResultTransformer
  ) {}

  #convertSchemas(schema: Schema): GeminiSchema {
    return toGeminiSchema(schema);

    function toGeminiSchema(schema: Schema): GeminiSchema {
      const type = typeof schema?.type === "string" ? schema.type : "string";
      switch (type.toLocaleLowerCase()) {
        case "object": {
          if (schema.behavior?.includes("llm-content")) {
            return {
              type: "string",
              description: schema.description || schema.title,
            };
          }
          if (!schema.properties) {
            return { type: "object" };
          }
          return {
            type: "object",
            properties: Object.fromEntries(
              Object.entries(schema.properties).map(([name, schema]) => {
                return [name, toGeminiSchema(schema)];
              })
            ),
            required: schema.required,
          };
        }
        case "array": {
          const items = schema.items as Schema;
          if (items.behavior?.includes("llm-content")) {
            return {
              type: "string",
              description: schema.description,
            };
          }
          return {
            type: "array",
            items: toGeminiSchema(schema.items as Schema),
          };
        }
        default: {
          const geminiSchema = { ...schema, type: type.toLocaleLowerCase() };
          delete geminiSchema.format;
          delete geminiSchema.behavior;
          delete geminiSchema.examples;
          delete geminiSchema.default;
          delete geminiSchema.transient;
          if (!geminiSchema.description) {
            geminiSchema.description = geminiSchema.title;
          }
          delete geminiSchema.title;
          return geminiSchema as GeminiSchema;
        }
      }
    }
  }

  #toName(title?: string) {
    return title ? title.replace(/\W/g, "_") : "function";
  }

  addSearch() {
    this.#hasSearch = true;
  }

  #createToolHandle(
    url: string,
    description: ExportDescriberResult,
    passContext: boolean,
    client?: McpToolAdapter
  ): [string, ToolHandle] {
    const name = this.#toName(description.title);
    const functionDeclaration: FunctionDeclaration = {
      name,
      description: description.description || "",
    };
    const parameters = this.#convertSchemas(description.inputSchema!);
    if (parameters.properties) {
      functionDeclaration.parameters = parameters;
    }
    return [name, { tool: functionDeclaration, url, passContext, client }];
  }

  #addOneTool(
    url: string,
    description: ExportDescriberResult,
    passContext: boolean,
    client?: McpToolAdapter
  ): Outcome<string> {
    const [name, handle] = this.#createToolHandle(
      url,
      description,
      passContext,
      client
    );
    this.tools.set(name, handle);
    return description.title || name;
  }

  addCustomTool(name: string, handle: ToolHandle) {
    this.tools.set(name, handle);
  }

  async addTool(part: ToolParamPart): Promise<Outcome<string>> {
    const { path: url, instance } = part;
    if (url?.endsWith(CODE_EXECUTION_SUFFIX)) {
      this.#hasCodeExection = true;
      return "Code Execution";
    }
    if (instance) {
      if (url === ROUTE_TOOL_PATH) {
        // This is a route, so it translates to nothing when using this method,
        // and in effect ignore the route. This is because the agent loop code
        // will handle routes in its own way.
        return "";
      } else {
        const client = new McpToolAdapter(this.caps, this.moduleArgs, url);
        // This is an integration. Use MCP connector.
        const tools = await client.listTools();
        if (!ok(tools)) return tools;
        const names: string[] = [];
        for (const tool of tools) {
          const { url, description } = tool;
          const { title } = description;
          if (title !== instance) continue;
          if (title) {
            names.push(title);
          }
          console.log("DESCRIPTION", description);
          this.#addOneTool(url, description, false, client);
        }
        return names.join(", ");
      }
    }

    let description = (await this.caps.describe({
      url,
    })) as Outcome<DescriberResult>;
    let passContext = false;
    if (!ok(description)) return description;

    // TODO: Remove this altogether?
    // Let's see if there are exports. If yes, let's add the exports
    // instead of the tool.
    if (description.exports) {
      let connector: ConnectorHandle | null = null;
      if (description.metadata?.tags?.includes("connector")) {
        // This is a connector
        connector = { tools: new Map() };
      }
      Object.entries(description.exports).forEach(([id, exportDescription]) => {
        // TODO: Figure out what to do with passContext
        const idAndHandle = this.#createToolHandle(
          id,
          exportDescription,
          passContext
        );
        const [name, handle] = idAndHandle;
        console.log("EXPORT DESCRIPTION", exportDescription);
        if (connector) {
          if (
            exportDescription.metadata?.tags?.includes("connector-configure")
          ) {
            connector.configure = idAndHandle;
            return;
          } else if (
            exportDescription.metadata?.tags?.includes("connector-load")
          ) {
            connector.load = idAndHandle;
            return;
          } else {
            connector.tools.set(name, handle);
          }
        }
        this.tools.set(name, handle);
      });
      return this.#toName(description.title);
    }

    // Otherwise, let's add the tool itself.
    if (this.describerResultTransformer) {
      const transforming =
        await this.describerResultTransformer.transform(description);
      if (!ok(transforming)) return transforming;
      if (transforming) {
        description = transforming;
        passContext = true;
      }
    }
    return this.#addOneTool(url, description, passContext);
  }

  async initialize(tools?: ToolDescriptor[]): Promise<boolean> {
    if (!tools) {
      return true;
    }
    let hasInvalidTools = false;
    for (const tool of tools) {
      const url = typeof tool === "string" ? tool : tool.url;
      const description = (await this.caps.describe({
        url,
      })) as Outcome<DescriberResult>;
      if (!ok(description)) {
        this.errors.push(description.$error);
        // Invalid tool, skip
        hasInvalidTools = true;
        continue;
      }
      const parameters = this.#convertSchemas(description.inputSchema!);
      const name = this.#toName(description.title);
      const functionDeclaration = {
        name,
        description: description.description || "",
        parameters,
      };
      this.tools.set(name, {
        tool: functionDeclaration,
        url,
        passContext: false,
      });
    }
    return !hasInvalidTools;
  }

  /**
   * Extracted out of callTools, but is slightly different, because we don't
   * need to handle custom tools or subgraphs or anything like that.
   * TODO: Reconcile with callTools
   */
  async callTool(
    part: FunctionCallCapabilityPart
  ): Promise<Outcome<CallToolResult>> {
    const { args, name } = part.functionCall;
    const handle = this.tools.get(name);
    if (!handle) {
      return err(`Unknown tool: "${name}"`);
    }

    const { url, passContext, client } = handle;
    console.log("CALLING TOOL", url, args, passContext);
    let callingTool;
    if (client) {
      callingTool = await client.callTool(
        name,
        args as Record<string, unknown>
      );
    } else {
      callingTool = await this.caps.invoke({
        $board: url,
        ...normalizeArgs(args, [], passContext),
      });
    }
    if (!ok(callingTool)) return callingTool;

    let saveOutputs = false;
    const results: LLMContent[] = [];
    const toolResult = callingTool as ToolOutput;
    if ("structured_result" in toolResult) {
      // The MCP output
      results.push(toolResult.structured_result);
      if (toolResult.saveOutputs) {
        saveOutputs = true;
      }
    } else {
      // The traditional path, where a string is returned.
      const responsePart: FunctionResponseCapabilityPart = {
        functionResponse: {
          name,
          response: callingTool,
        },
      };
      const toolResponseContent: LLMContent = {
        role: "user",
        parts: [responsePart],
      };
      console.log("toolResponseContent: ", toolResponseContent);
      results.push(toolResponseContent);
      console.log("gemini-prompt processResponse: ", results);
    }
    return { saveOutputs, results };
  }

  async callTools(
    response: LLMContent,
    allowToolErrors: boolean,
    context: LLMContent[]
  ): Promise<Outcome<CallToolsResult>> {
    const results: LLMContent[][] = [];
    const errors: string[] = [];
    let calledTools = false;
    let calledCustomTools = false;
    let saveOutputs = false;
    if (!response.parts) {
      return { results, calledTools, calledCustomTools, saveOutputs };
    }

    for (const part of response.parts) {
      if (!("functionCall" in part)) continue;
      const { args, name } = part.functionCall;
      const handle = this.tools.get(name);
      if (!handle) continue;
      if (handle.invoke) {
        await handle.invoke(args as Record<string, unknown>);
      } else {
        const { url, passContext, client } = handle;
        console.log("CALLING TOOL", url, args, passContext);
        calledTools = true;
        if (passContext) {
          // Passing context means we called a subgraph/'custom tool'.
          calledCustomTools = true;
        }
        let callingTool;
        if (client) {
          callingTool = await client.callTool(
            name,
            args as Record<string, unknown>
          );
        } else
          callingTool = await this.caps.invoke({
            $board: url,
            ...normalizeArgs(args, context, passContext),
          });
        if ("$error" in callingTool) {
          errors.push(JSON.stringify(callingTool.$error));
        } else if (name === undefined) {
          errors.push(`No function name for ${JSON.stringify(callingTool)}`);
        } else {
          const toolResult = callingTool as ToolOutput;
          if ("structured_result" in toolResult) {
            // The MCP output
            results.push([toolResult.structured_result]);
            if (toolResult.saveOutputs) {
              saveOutputs = true;
            }
          } else {
            // The traditional path, where a string is returned.
            if (passContext) {
              if (!("context" in callingTool)) {
                errors.push(`No "context" port in outputs of "${url}"`);
              } else {
                const response = {
                  ["value"]: JSON.stringify(
                    callingTool.context as LLMContent[]
                  ),
                };
                const responsePart: FunctionResponseCapabilityPart = {
                  functionResponse: {
                    name,
                    response: response,
                  },
                };
                const toolResponseContent: LLMContent = {
                  role: "user",
                  parts: [responsePart],
                };
                results.push([toolResponseContent]);
                console.log(
                  "gemini-prompt + passContext, processResponse: ",
                  results
                );
              }
            } else {
              const responsePart: FunctionResponseCapabilityPart = {
                functionResponse: {
                  name,
                  response: callingTool,
                },
              };
              const toolResponseContent: LLMContent = {
                role: "user",
                parts: [responsePart],
              };
              console.log("toolResponseContent: ", toolResponseContent);
              results.push([toolResponseContent]);
              console.log("gemini-prompt processResponse: ", results);
            }
          }
        }
      }
    }

    console.log("ERRORS", errors);
    if (errors.length && !allowToolErrors) {
      return err(
        `Calling tools generated the following errors: ${errors.join(",")}`
      );
    }
    return {
      results,
      saveOutputs,
      calledCustomTools,
      calledTools,
    };
  }

  hasToolDeclarations(): boolean {
    return this.tools.size !== 0;
  }

  hasTools(): boolean {
    let size = this.tools.size;
    if (this.#hasCodeExection) {
      size++;
    }
    if (this.#hasSearch) {
      size++;
    }
    if (this.#hasMaps) {
      size++;
    }
    return size !== 0;
  }

  list(): Tool[] {
    const declaration: Tool = {};
    const entries = [...this.tools.entries()];
    if (entries.length !== 0) {
      declaration.functionDeclarations = entries.map(([, value]) => value.tool);
    }
    if (this.#hasSearch) {
      declaration.googleSearch = {};
    }
    if (this.#hasMaps) {
      declaration.googleMaps = {};
    }
    if (this.#hasCodeExection) {
      declaration.codeExecution = {};
    }
    if (Object.keys(declaration).length === 0) return [];
    return [declaration];
  }
}

function normalizeArgs(
  a: object,
  context: LLMContent[],
  passContext?: boolean
) {
  if (!passContext) return a;
  const args = a as Record<string, unknown>;
  context = [...context];
  const hasContext = "context" in args;
  const contextArg = hasContext
    ? {}
    : {
        context,
      };
  return {
    ...contextArg,
    ...Object.fromEntries(
      Object.entries(args).map(([name, value]) => {
        if (hasContext) {
          value = addUserTurn(value as string, [...context]);
        }
        return [name, value];
      })
    ),
  };
}
