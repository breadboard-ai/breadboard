/**
 * @fileoverview Add a description for your module here.
 */

import describeGraph from "@describe";
import invokeGraph from "@invoke";
import { ok, err } from "./utils";
import type {
  DescriberResult,
  ExportDescriberResult,
  DescriberResultTransformer,
  CallToolCallback,
} from "./common";
import {
  type FunctionDeclaration,
  type GeminiSchema,
  type Tool,
} from "./gemini";
import { ConnectorManager } from "./connector-manager";

export type ToolHandle = {
  tool: FunctionDeclaration;
  url: string;
  passContext: boolean;
  connector?: ConnectorManager;
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

export { ToolManager };

class ToolManager {
  #hasSearch = false;
  tools: Map<string, ToolHandle> = new Map();
  connectors: Map<string, ConnectorHandle> = new Map();
  errors: string[] = [];

  constructor(
    private readonly describerResultTransformer?: DescriberResultTransformer
  ) {}

  #convertSchemas(schema: Schema): GeminiSchema {
    return toGeminiSchema(schema);

    function toGeminiSchema(schema: Schema): GeminiSchema {
      switch (schema.type) {
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
          const geminiSchema = { ...schema };
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
    connector?: ConnectorManager
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
    return [name, { tool: functionDeclaration, url, passContext, connector }];
  }

  #addOneTool(
    url: string,
    description: ExportDescriberResult,
    passContext: boolean,
    connector?: ConnectorManager
  ): Outcome<string> {
    const [name, handle] = this.#createToolHandle(
      url,
      description,
      passContext,
      connector
    );
    this.tools.set(name, handle);
    return description.title || name;
  }

  async addTool(url: string, instance?: string): Promise<Outcome<string>> {
    if (instance) {
      // This is a connector.
      const connector = new ConnectorManager({ path: instance });
      const tools = await connector.listTools();
      if (!ok(tools)) return tools;
      for (const tool of tools) {
        const { url, description } = tool;
        this.#addOneTool(url, description, false, connector);
      }
      // Return empty string, which will inform the
      // substitution machinery to just reuse title.
      return "";
    }

    let description = (await describeGraph({
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
      const description = (await describeGraph({
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

  async processResponse(response: LLMContent, callTool: CallToolCallback) {
    for (const part of response.parts) {
      if ("functionCall" in part) {
        const { args, name } = part.functionCall;
        const handle = this.tools.get(name);
        if (handle) {
          const { url, passContext, connector } = handle;
          if (connector) {
            await connector.invokeTool(
              name,
              args as Record<string, unknown>,
              callTool
            );
          } else {
            await callTool(url, part.functionCall.args, passContext);
          }
        }
      }
    }
  }

  hasTools(): boolean {
    return this.tools.size !== 0;
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
    if (Object.keys(declaration).length === 0) return [];
    return [declaration];
  }
}
