/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyRunRequestMessage, RemoteMessage } from "@breadboard-ai/types";
import { PatchedReadableStream } from "../stream.js";

export interface ClientBidirectionalStream<Request, Response> {
  writableRequests: WritableStream<Request>;
  readableResponses: PatchedReadableStream<Response>;
}

export interface ServerBidirectionalStream<Request, Response> {
  readableRequests: PatchedReadableStream<Request>;
  writableResponses: WritableStream<Response>;
}

export interface ServerTransport<Request, Response> {
  createServerStream(): ServerBidirectionalStream<Request, Response>;
}

export interface ClientTransport<Request, Response> {
  createClientStream(): ClientBidirectionalStream<Request, Response>;
}

export type RunClientTransport = ClientTransport<
  AnyRunRequestMessage,
  RemoteMessage
>;
