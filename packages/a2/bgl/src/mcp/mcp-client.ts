/**
 * @fileoverview Breadboard MCP Client
 */

import fetch from "@fetch";
import read from "@read";
import write from "@write";
import query from "@query";

import { ok, err } from "./a2/utils";

export { McpClient };

export type InitializeResponse = {
  capabilities: {
    resources?: {};
    tools?: {};
    prompts?: {};
  };
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
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

function json<T>(result: FileSystemReadResult) {
  if (!ok(result)) return result;
  const j = (result.data?.at(-1)?.parts.at(0) as JSONPart)?.json;
  if (!j) {
    return err(`Invalid result structure`);
  }
  return j as T;
}

function sse<T extends JsonSerializable>(result: FileSystemReadResult) {
  const e = json<ServerSentEvent<T>>(result);
  if (!ok(e)) return e;
  return e.data;
}

function rpc<M extends MCPResponse>(result: FileSystemReadResult) {
  const e = sse<JsonRpcResponse<M>>(result);
  if (!ok(e)) return e;
  return e.result;
}

class McpClient {
  #id: number = 0;
  #messageEndpoint: string | null = null;

  constructor(
    public readonly connectorId: string,
    public readonly url: string
  ) {}

  #path(): FileSystemReadWritePath {
    return `/session/mcp/${this.connectorId}/stream`;
  }

  #sessionIdPath(): FileSystemReadWritePath {
    return `/session/mcp/${this.connectorId}/id`;
  }

  #newId() {
    return ++this.#id;
  }

  async connect(): Promise<Outcome<void>> {
    if (this.#messageEndpoint) {
      return err(`Already connected to "${this.#messageEndpoint}"`);
    }
    const file = this.#path();
    const url = this.url;

    const savedSession = json<SavedMessageEndpoint>(
      await read({ path: this.#sessionIdPath() })
    );
    if (ok(savedSession)) {
      console.log("EXISTING SESSION", savedSession);
      this.#messageEndpoint = savedSession.endpoint;
      return;
    }

    // Establish connection.
    const connecting = await fetch({ url, file, stream: "sse" });
    if (!ok(connecting)) return connecting;
    // This is the connection path.
    const path = connecting.response as FileSystemReadWritePath;

    // Read the endpoint event
    const connection = sse(await read({ path }));
    if (!ok(connection)) return connection;

    // do some crude URL munging.
    const hostname = url.split("/").slice(0, -1).join("/");
    const messageEndpoint = `${hostname}${connection}`;

    const id = this.#newId();

    // send initialize request
    const initializing = await fetch({
      url: messageEndpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "Breadboard",
            version: "1.0.0",
          },
          capabilities: {
            tools: {},
          },
        },
      }),
    });
    if (!ok(initializing)) return initializing;

    const initializeResponse = rpc<InitializeResponse>(await read({ path }));
    if (!ok(initializeResponse)) return initializeResponse;

    const confirmInitialization = await fetch({
      url: messageEndpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    if (!ok(confirmInitialization)) return confirmInitialization;

    this.#messageEndpoint = messageEndpoint;
    // Save message endpoint
    const savingMessageEndpoint = await write({
      path: this.#sessionIdPath(),
      data: [
        {
          parts: [{ json: { endpoint: messageEndpoint } }],
        },
      ],
    });
    if (!ok(savingMessageEndpoint)) return savingMessageEndpoint;
  }

  async listTools(): Promise<Outcome<ListToolsTool[]>> {
    if (!this.#messageEndpoint) {
      return err(`The client wasn't initialized. Call "connect" first.`);
    }
    const url = this.#messageEndpoint;
    const id = this.#newId();
    const path = this.#path();
    // get list of tools
    const askToListTools = await fetch({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/list",
      }),
    });
    if (!ok(askToListTools)) return askToListTools;

    const toolList = rpc<ListToolsResponse>(await read({ path }));
    if (!ok(toolList)) return toolList;
    return toolList.tools;
  }

  async callTool(
    name: string,
    args: Record<string, JsonSerializable>
  ): Promise<Outcome<CallToolContent[]>> {
    if (!this.#messageEndpoint) {
      return err(`The client wasn't initialized. Call "connect" first.`);
    }

    const url = this.#messageEndpoint;
    const id = this.#newId();
    const path = this.#path();

    // Call tool
    const askToCallTool = await fetch({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const readCallToolResults = rpc<CallToolResponse>(await read({ path }));
    if (!ok(readCallToolResults)) return readCallToolResults;
    return readCallToolResults.content;
  }

  async disconnect(): Promise<Outcome<void>> {
    const path = this.#path();

    // Close the stream.
    const deleting = await write({ path, delete: true });
    // Delete the saved session
    const deletingSession = await write({
      path: this.#sessionIdPath(),
      delete: true,
    });
    if (!ok(deleting)) return deleting;
    if (!ok(deletingSession)) return deletingSession;
  }
}
