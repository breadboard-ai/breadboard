/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  JsonSerializable,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { proxyFileSystemBackend };

function proxyFileSystemBackend(baseURL: URL, tokenGetter: TokenGetter) {
  return new ProxiedPersistentBackend(baseURL, tokenGetter);
}

type TokenGetter = () => Promise<Outcome<string>>;

class ProxiedPersistentBackend implements PersistentBackend {
  constructor(
    public readonly baseUrl: URL,
    private readonly tokenGetter: TokenGetter
  ) {}

  async #fetch(
    method: "POST" | "GET" | "DELETE",
    path: string,
    body?: JsonSerializable
  ): Promise<Outcome<JsonSerializable>> {
    try {
      const accessToken = await this.tokenGetter();
      if (!ok(accessToken)) return accessToken;
      const response = await fetch(new URL(path, this.baseUrl), {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: method === "POST" && body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const msg = "Proxied backend fetch failed";
        console.warn(msg, await response.text());
        return err(`${msg}: ${response.statusText}`);
      }
      return response.json();
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async query(
    _graphUrl: string,
    _path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    return err(`Proxied backend does not support "query" method.`);
  }

  async read(
    _graphUrl: string,
    path: FileSystemPath,
    _inflate: boolean
  ): Promise<Outcome<LLMContent[]>> {
    const fetching = await this.#fetch("GET", path);
    if (!ok(fetching)) return fetching;
    // TODO: Verify returned data structure matches presumed shape.
    return fetching as LLMContent[];
  }

  async write(
    _graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const fetching = await this.#fetch("POST", path, data as JsonSerializable);
    if (!ok(fetching)) return fetching;
    // TODO: Verify returned data structure matches presumed shape.
    return fetching as FileSystemWriteResult;
  }

  async append(
    _graphUrl: string,
    _path: FileSystemPath,
    _data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return err(`Proxied backend does not support "append" method.`);
  }

  async delete(
    _graphUrl: string,
    path: FileSystemPath,
    _all: boolean
  ): Promise<FileSystemWriteResult> {
    const fetching = await this.#fetch("DELETE", path);
    if (!ok(fetching)) return fetching;
    // TODO: Verify returned data structure matches presumed shape.
    return fetching as FileSystemWriteResult;
  }

  async copy(
    _graphUrl: string,
    _source: FileSystemPath,
    _destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    return err(`Proxied backend does not support "copy" method.`);
  }

  async move(
    _graphUrl: string,
    _source: FileSystemPath,
    _destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    return err(`Proxied backend does not support "move" method.`);
  }
}
