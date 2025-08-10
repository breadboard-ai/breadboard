/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemReadWritePath,
  FileSystemWriteResult,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { err, fromJson, ok, toJson } from "@breadboard-ai/utils";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolRequest,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";

export { McpFileSystemBackend, parsePath };

const COMMON_PREFIX: FileSystemPath = `/mnt/mcp/session`;
const SUPPORTED_METHODS = ["info", "listTools", "callTool"] as const;

export type HandshakeResponse = {
  session: FileSystemReadWritePath;
  info: Implementation | undefined;
};

type McpMethod = (typeof SUPPORTED_METHODS)[number];

type PathInfo =
  | {
      type: "handshake";
    }
  | {
      type: "session";
      id: string;
      method: McpMethod;
    };

type SessionInfo = {
  id: string;
  client: Client | null;
  response: Promise<Outcome<LLMContent[]>> | null;
};

type InitializeSessionWrite = {
  /**
   * URL of the MCP server to connect to
   */
  url: string;
  /**
   * MCP Client Information
   */
  info: Implementation;
};

type CallToolRequestWrite = CallToolRequest["params"];

/**
 * Provides the ability to use MCP via the FileSystem.
 * The expected path is /mnt/mcp
 */
class McpFileSystemBackend implements PersistentBackend {
  #sessions: Map<string, SessionInfo> = new Map();

  async query(
    _graphUrl: string,
    _path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    return err(`MCP Backend does not support "query" method.`);
  }

  async read(
    _graphUrl: string,
    path: FileSystemPath
  ): Promise<Outcome<LLMContent[]>> {
    const parsingPath = parsePath(path);
    if (!ok(parsingPath)) return parsingPath;

    // There can be one kind of reads:
    // - response read, which will always be of the form
    //   `/mnt/mcp/session/<session id>`
    if (parsingPath.type !== "session") {
      return err(`MCP Backend: Uknown type in path "${path}`);
    }
    const info = this.#sessions.get(parsingPath.id);
    if (!info) {
      return err(`MCP Backend: unknown session id in path "${path}"`);
    }
    if (!info.response) {
      return err(
        `MCP Backend: invalid call sequence for path "${path}". Please write request first`
      );
    }
    const response = info.response;
    info.response = null;
    return response;
  }

  async #initializeSession(data: LLMContent[]): Promise<FileSystemWriteResult> {
    const initialization = toJson<InitializeSessionWrite>(data);
    if (!initialization) {
      return err(`MCP Backend: invalid session initialization payload`);
    }

    try {
      const client = new Client(initialization.info);
      const transport = new StreamableHTTPClientTransport(
        new URL(initialization.url)
      );

      // TODO: Implement error handling and retry.
      await client.connect(transport);
      const id = crypto.randomUUID();
      const response = Promise.resolve(
        fromJson<HandshakeResponse>({
          session: `${COMMON_PREFIX}/${id}` as FileSystemReadWritePath,
          info: client.getServerVersion(),
        })
      );
      this.#sessions.set(id, { id, response, client });
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async #closeSession(id: string): Promise<FileSystemWriteResult> {
    const session = this.#sessions.get(id);
    if (!session) {
      return err(`MCP Backend: unknown session id "${id}"`);
    }
    if (!session.client) {
      return err(
        `MCP Backend: unable to close session "${id}", because client doesn't exist.`
      );
    }
    try {
      await session.client.close();
      this.#sessions.delete(id);
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async #invokeMethod(
    id: string,
    method: McpMethod,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const session = this.#sessions.get(id);
    if (!session) {
      return err(`MCP Backend: unknown session id "${id}"`);
    }
    if (!session.client) {
      return err(
        `MCP Backend: unable to invoke method "${method}", because session "${id}" hasn't been initialized yet.`
      );
    }
    if (session.response) {
      return err(
        `MCP Backend: invalid call sequence for session "${id}". Read the response first.`
      );
    }
    switch (method) {
      case "callTool": {
        const params = toJson<CallToolRequestWrite>(data);
        if (!params) {
          return err(`MCP Backend: Missing parameters for "callTool" method`);
        }
        session.response = session.client
          .callTool(params)
          .then((result) => fromJson(result.content))
          .catch((e) => err((e as Error).message));
        break;
      }
      case "listTools": {
        session.response = session.client
          .listTools()
          .then((result) => fromJson(result.tools))
          .catch((e) => err((e as Error).message));
        break;
      }
      default: {
        return err(`MCP Backend: unkonwn method "${method}"`);
      }
    }
  }

  async write(
    _graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const parsingPath = parsePath(path);
    if (!ok(parsingPath)) return parsingPath;

    // There can be two types of write:
    // - session initialization write of the form
    //   `/mnt/mcp/session`
    // - session write, which will always be of the form
    //  `/mnt/mcp/session/<session id>
    const { type } = parsingPath;
    switch (type) {
      case "handshake": {
        return this.#initializeSession(data);
      }
      case "session": {
        return this.#invokeMethod(parsingPath.id, parsingPath.method, data);
      }
      default: {
        return err(`MCP Backend does not support writing to path "${path}"`);
      }
    }
  }

  async append(
    _graphUrl: string,
    _path: FileSystemPath,
    _data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return err(`MCP Backend does not support appending with "write" method`);
  }

  async delete(
    _graphUrl: string,
    path: FileSystemPath,
    _all: boolean
  ): Promise<FileSystemWriteResult> {
    const parsingPath = parsePath(path);
    if (!ok(parsingPath)) return parsingPath;

    if (parsingPath.type !== "session") {
      return err(
        `MCP Backend: invalid session close requeset at path "${path}"`
      );
    }
    return this.#closeSession(parsingPath.id);
  }

  async copy(
    _graphUrl: string,
    _source: FileSystemPath,
    _destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    return err(`MCP Backend does not support copying`);
  }

  async move(
    _graphUrl: string,
    _source: FileSystemPath,
    _destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    return err(`MCP Backend does not support moving`);
  }
}

function parsePath(path: FileSystemPath): Outcome<PathInfo> {
  if (!path.startsWith(COMMON_PREFIX)) {
    return err(`MCP Backend does not support path "${path}`);
  }

  const [, , , , id, methodString, ...rest] = path.split("/");
  if (rest.length > 0) {
    return err(`MCP Backend: too many segments in path "${path}"`);
  }
  if (!id) {
    return { type: "handshake" };
  }
  const method = methodString as McpMethod;
  if (!SUPPORTED_METHODS.includes(method)) {
    return err(`MCP Backend: invalid method "${method}" in path "${path}"`);
  }
  return { type: "session", id, method };
}
