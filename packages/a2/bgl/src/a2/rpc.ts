/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import read from "@read";
import { err, toJson, fromJson, ok } from "./utils";
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
  const handshake = toJson<HandshakeResponse>(readingHandshake.data);
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

  const response = toJson<Out>(readingResponse.data);
  if (!response) {
    return err(`Empty response returned at path "${path}"`);
  }
  return response;
}

export type SessionHandshakeResponse<Info> = {
  // File path unique for this session, used to both read and write.
  session: FileSystemReadWritePath;
  info: Info;
};

const SESSION_CACHE_PREFIX = "/session/rpc";

abstract class RpcSession<
  Args extends JsonSerializable,
  Info extends JsonSerializable,
> {
  #session: Outcome<SessionHandshakeResponse<Info>> | undefined;

  constructor(public readonly path: FileSystemReadWritePath) {}

  /**
   * Creates a session key for caching. Must be unique to the session.
   */
  protected abstract createSessionKey(): string;

  /**
   * Gets the arguments that will be used to initialize the session.
   */
  protected abstract getInitArgs(): Args;

  async session(): Promise<Outcome<SessionHandshakeResponse<Info>>> {
    const path =
      `${SESSION_CACHE_PREFIX}/${encodeURIComponent(this.createSessionKey())}` as FileSystemReadWritePath;
    if (!this.#session) {
      // First, attempt to read session from session cache. If found, see if
      // we can resume that session.
      // Otherwise, fall through to create a new session.
      // Falling through will write over the existing invalid cached session
      // data, if any. That is okay.
      const sessionInfo = await read({ path });
      if (ok(sessionInfo)) {
        const existingSession = toJson<Outcome<SessionHandshakeResponse<Info>>>(
          sessionInfo.data
        );
        if (existingSession) {
          this.#session = existingSession;
          return this.#session;
        }
      }
    }
    const newSession = await this.#openSession(this.getInitArgs());
    if (!ok(newSession)) return newSession;

    const caching = await write({ path, data: fromJson(newSession) });
    if (!ok(caching)) return caching;

    this.#session = newSession;
    return this.#session;
  }

  async info(): Promise<Outcome<Info>> {
    const session = await this.session();
    if (!ok(session)) return session;
    return session.info;
  }

  async #openSession(
    args: Args
  ): Promise<Outcome<SessionHandshakeResponse<Info>>> {
    const { path } = this;
    const handshake = await this.#rpc<Args, SessionHandshakeResponse<Info>>(
      path,
      args
    );
    if (!ok(handshake)) {
      return err(`Unable to establish RPC handshake at "${path}"`);
    }
    if (!handshake.session || typeof handshake.session !== "string") {
      return err(`Invalid RPC handshake response at "${path}"`);
    }
    return handshake;
  }

  async #rpc<In extends JsonSerializable, Out extends JsonSerializable>(
    path: FileSystemReadWritePath,
    inputs: In
  ): Promise<Outcome<Out>> {
    const writing = await write({ path, data: fromJson<In>(inputs) });
    if (!ok(writing)) return writing;
    const reading = await read({ path });
    if (!ok(reading)) return reading;
    const result = toJson<Out>(reading.data);
    if (!result) {
      return err(`Invalid RPC response at "${path}"`);
    }
    return result;
  }

  async call<In extends JsonSerializable, Out extends JsonSerializable>(
    method: string,
    data: In
  ): Promise<Outcome<Out>> {
    const session = await this.session();
    if (!ok(session)) return session;

    const path = `${session.session}/${method}` as FileSystemReadWritePath;
    return await this.#rpc<In, Out>(path, data);
  }

  async close(): Promise<Outcome<void>> {
    if (!this.#session) {
      return err(
        `Not in RPC session. Please open the session before making calls`
      );
    }
    const session = await this.session();
    if (!ok(session)) return session;

    return write({ path: session.session, delete: true });
  }
}
