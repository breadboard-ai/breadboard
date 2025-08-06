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
  JSONPart,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { McpFileSystemBackend };

const COMMON_PREFIX: FileSystemPath = `/mnt/mcp`;
const HADNSHAKE_TYPE = "call";
const RESPONSE_TYPE = "res";
const REQUEST_TYPE = "req";

export type HandshakeResponse = {
  response: FileSystemPath;
  request: FileSystemReadWritePath;
};

type PathInfo = {
  type: string;
  name: string;
};

type CallInfo = {
  id: string;
  name: string;
  response?: Promise<LLMContent[]>;
};

type RequestWrite = {
  /**
   * URL of the MCP server to connect to
   */
  url: string;
};

/**
 * Provides the ability to use MCP via the FileSystem.
 * The expected path is /mnt/mcp
 */
class McpFileSystemBackend implements PersistentBackend {
  #calls: Map<string, CallInfo> = new Map();

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

    const { type, name } = parsingPath;

    // There can be two kinds of reads:
    // - handshake read, which will always be of the form
    //   `/mnt/mcp/call/<method name>`
    // - response read, which will always be of the form
    //   `/mnt/mcp/res/<handshake id>`
    if (type === HADNSHAKE_TYPE) {
      const id = crypto.randomUUID();

      this.#calls.set(id, { id, name });
      const json: HandshakeResponse = {
        response: `${COMMON_PREFIX}/res/${id}` as FileSystemPath,
        request: `${COMMON_PREFIX}/req/${id}` as FileSystemReadWritePath,
      };
      return [{ parts: [{ json }] }];
    } else if (type === RESPONSE_TYPE) {
      // TODO: Implement this properly
      const info = this.#calls.get(name);
      if (!info) {
        return err(`MCP Backend: unknown response id in path "${path}"`);
      }
      if (!info.response) {
        return err(
          `MCP Backend: invalid call sequence for path "${path}. Please write request first`
        );
      }
      this.#calls.delete(name);
      return info.response;
    }
    return err(`MCP Backend: Uknown type in path "${path}`);
  }

  async write(
    _graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const parsingPath = parsePath(path);
    if (!ok(parsingPath)) return parsingPath;

    const { type, name } = parsingPath;
    // There can be only one kind of write:
    // - request write, which will always be of the form
    //  `/mnt/mcp/req/<handshake id>
    if (type !== REQUEST_TYPE) {
      return err(`MCP Backend does not support writing to path "${path}"`);
    }
    const info = this.#calls.get(name);
    if (!info) {
      return err(`MCP Backend: unknown request id in path "${path}"`);
    }
    const request = json(data) as RequestWrite;
    if (!request.url) {
      return err(`MCP Backend: missing server URL`);
    }
    // Simulate a response.
    info.response = Promise.resolve([
      {
        parts: [
          {
            json: {
              message: `STUFF IS HAPPENING ${request.url}.${info.name}, ${JSON.stringify(request)}`,
            },
          },
        ],
      },
    ]);

    return;
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
    _path: FileSystemPath,
    _all: boolean
  ): Promise<FileSystemWriteResult> {
    return err(`MCP Backend does not support "delete" method`);
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

  const [, , , type, name, ...rest] = path.split("/");
  if (rest.length > 0) {
    return err(`MCP Backend: too many segments in path "${path}"`);
  }
  if (!type) {
    return err(`MCP Backend: can't determine type from path "${path}"`);
  }
  if (!name) {
    return err(`MCP Backend: can't determine method name from path "${path}"`);
  }
  return { type, name };
}

function json<T>(data: LLMContent[] | undefined): T | undefined {
  return (data?.at(0)?.parts?.at(0) as JSONPart)?.json as T;
}
