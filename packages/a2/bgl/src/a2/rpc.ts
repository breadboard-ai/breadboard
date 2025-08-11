/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import read from "@read";
import { err, json, ok } from "./utils";
import write from "@write";

export { rpc };

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
