/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import read from "@read";
import { err, json, ok } from "./utils";
import write from "@write";

export { rpc, RpcSession };

export type RpcArgs = {
  /**
   * The path to the RPC handshake endpoint
   */
  path: FileSystemPath;
  data: JsonSerializable;
};

export type HandshakeResponse = {
  response: FileSystemPath;
  request: FileSystemReadWritePath;
};

async function rpc<Out = JsonSerializable>({
  path,
  data,
}: RpcArgs): Promise<Outcome<Out>> {
  const readingHandshake = await read({ path });
  if (!ok(readingHandshake)) return readingHandshake;
  const handshake = json<HandshakeResponse>(readingHandshake.data);
  if (!handshake) {
    return err(`Unable to establish handshake at "${path}"`);
  }
  if (!handshake.request || !handshake.response) {
    return err(`Invalid handshake response at "${path}"`);
  }

  const llmContentData: LLMContent[] = [{ parts: [{ json: data }] }];

  const writingRequest = await write({
    path: handshake.request,
    data: llmContentData,
  });
  if (!ok(writingRequest)) return writingRequest;

  const readingResponse = await read({ path: handshake.response });
  if (!ok(readingResponse)) return readingResponse;

  const response = json(readingResponse.data);
  if (!response) {
    return err(`Empty response returned at path "${path}"`);
  }
  return response as Out;
}

export type SessionHandshakeResponse = {
  // File path unique for this session, used to both read and write.
  session: FileSystemReadWritePath;
};

class RpcSession {
  #session: Promise<Outcome<FileSystemReadWritePath>> | undefined;

  constructor(public readonly path: FileSystemReadWritePath) {}

  async session(): Promise<Outcome<FileSystemReadWritePath>> {
    if (!this.#session) {
      this.#session = this.#openSession();
    }
    return this.#session;
  }

  async #openSession(): Promise<Outcome<FileSystemReadWritePath>> {
    const { path } = this;
    const readingHandshake = await read({ path });
    if (!ok(readingHandshake)) return readingHandshake;
    const handshake = json<SessionHandshakeResponse>(readingHandshake.data);
    if (!handshake) {
      return err(`Unable to establish RPC handshake at "${path}"`);
    }
    if (!handshake.session || typeof handshake.session !== "string") {
      return err(`Invalid RPC handshake response at "${path}"`);
    }
    return handshake.session;
  }

  async call<In extends JsonSerializable, Out extends JsonSerializable>(
    data: In
  ): Promise<Outcome<Out>> {
    const session = await this.session();
    if (!ok(session)) return session;

    const llmContentData: LLMContent[] = [{ parts: [{ json: data }] }];

    const writingRequest = await write({
      path: session,
      data: llmContentData,
    });
    if (!ok(writingRequest)) return writingRequest;

    const readingResponse = await read({ path: session });
    if (!ok(readingResponse)) return readingResponse;

    const response = json<Out>(readingResponse.data);
    if (!response) {
      return err(`Empty RPC response returned for session "${session}"`);
    }
    return response;
  }

  async close(): Promise<Outcome<void>> {
    if (!this.#session) {
      return err(
        `Not in RPC session. Please open the session before making calls`
      );
    }
    const session = await this.session();
    if (!ok(session)) return session;

    return write({ path: session, delete: true });
  }
}
