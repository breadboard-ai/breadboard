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
import {
  CallToolRequest,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpClient } from "./types.js";
import { McpClientFactory } from "./client-factory.js";

export { McpFileSystemBackend, parsePath };

const COMMON_PREFIX: FileSystemPath = `/mnt/mcp/session`;
const SUPPORTED_METHODS = ["connect", "listTools", "callTool"] as const;

export type HandshakeResponse = {
  session: FileSystemReadWritePath;
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
  client: McpClient | null;
  // TODO: Implement support for per-method response.
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

type TokenGetter = () => Promise<Outcome<string>>;

/**
 * Provides the ability to use MCP via the FileSystem.
 * The expected path is /mnt/mcp
 */
class McpFileSystemBackend implements PersistentBackend {
  #sessions: Map<string, SessionInfo> = new Map();
  #clientFactory: McpClientFactory;

  constructor(tokenGetter: TokenGetter, proxyUrl?: string) {
    this.#clientFactory = new McpClientFactory(tokenGetter, proxyUrl);
  }

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

    // There can be two kinds of reads:
    // - handshake read:
    //   `/mnt/mcp/session
    // - response read, which will always be of the form
    //   `/mnt/mcp/session/<session id>/<method>`
    const { type } = parsingPath;
    switch (type) {
      case "handshake": {
        // Create a blank new session and return it
        const id = crypto.randomUUID();
        this.#sessions.set(id, { id, response: null, client: null });
        return fromJson<HandshakeResponse>({
          session: `${COMMON_PREFIX}/${id}` as FileSystemReadWritePath,
        });
      }
      case "session": {
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
      default: {
        return err(`MCP Backend: Unknown type in path "${path}"`);
      }
    }
  }

  async #initializeClient(data: LLMContent[]): Promise<Outcome<McpClient>> {
    const initialization = toJson<InitializeSessionWrite>(data);
    if (!initialization) {
      return err(`MCP Backend: invalid session initialization payload`);
    }
    const { url, info } = initialization;

    if (!url) {
      return err(`MCP Backend: no server URL supplied`);
    }

    return this.#clientFactory.createClient(url, info);
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
    if (!session.client && method !== "connect") {
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
      case "connect": {
        const client = await this.#initializeClient(data);
        if (!ok(client)) return client;

        const response = Promise.resolve(
          fromJson<Implementation | undefined>(client.getServerVersion())
        );
        this.#sessions.set(id, { id, response, client });

        break;
      }
      case "callTool": {
        const params = toJson<CallToolRequestWrite>(data);
        if (!params) {
          return err(`MCP Backend: Missing parameters for "callTool" method`);
        }
        session.response = session
          .client!.callTool(params)
          .then((result) => fromJson(result.content))
          .catch((e) => err((e as Error).message));
        break;
      }
      case "listTools": {
        session.response = session
          .client!.listTools()
          .then((result) => fromJson(result.tools))
          .catch((e) => err((e as Error).message));
        break;
      }
      default: {
        return err(`MCP Backend: unknown method "${method}"`);
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

    // There can be one type of write:
    // - session write, which will always be of the form
    //  `/mnt/mcp/session/<session id>/<method>
    const { type } = parsingPath;
    switch (type) {
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

  async onEndRun(): Promise<void> {
    for (const id of this.#sessions.keys()) {
      const closing = await this.#closeSession(id);
      if (!ok(closing)) {
        console.warn("MCP Backend: error closing session", closing.$error);
      }
    }
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
