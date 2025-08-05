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
  data: LLMContent[];
};

export type HandshakeResponse = {
  response: FileSystemPath;
  request: FileSystemReadWritePath;
};

async function rpc({
  path,
  data,
}: RpcArgs): Promise<Outcome<FileSystemReadResult>> {
  const readingHandshake = await read({ path });
  if (!ok(readingHandshake)) return readingHandshake;
  console.log("READING HANDSHAKE", readingHandshake);
  const handshake = json<HandshakeResponse>(readingHandshake.data);
  if (!handshake) {
    return err(`Unable to establish handshake at "${path}"`);
  }
  if (!handshake.request || !handshake.response) {
    return err(`Invalid handshake response at "${path}"`);
  }

  const writingRequest = await write({ path: handshake.request, data });
  if (!ok(writingRequest)) return writingRequest;

  return read({ path: handshake.response });
}
