/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ClientTransport,
  LoadResponse,
  ServerTransport,
} from "../remote/protocol.js";
import { AnyClientRunResult, ClientRunResult } from "../remote/run.js";
import {
  ErrorResponse,
  InputResponse,
  OutputResponse,
  OutputValues,
  ProbeMessage,
} from "../types.js";

/**
 * The board has been loaded
 */
export type LoadResult = {
  type: "load";
  data: LoadResponse;
};

/**
 * The board is asking for input
 */
export type InputResult = {
  type: "input";
  data: InputResponse;
};

/**
 * The board is sending output
 */
export type OutputResult = {
  type: "output";
  data: OutputResponse;
};

/**
 * Sent when the harness is asking for secret
 */
export type SecretResult = {
  type: "secret";
  data: { keys: string[] };
};

/**
 * Sent when the board run process reports an error
 */
export type ErrorResult = {
  type: "error";
  data: ErrorResponse;
};

/**
 * Sent when the board run finished
 */
export type EndResult = {
  type: "end";
  data: Record<string, never>;
};

export type AnyRunResult =
  | InputResult
  | OutputResult
  | SecretResult
  | ErrorResult
  | EndResult
  | ProbeMessage;

export type HarnessRunResult =
  | AnyClientRunResult
  | ClientRunResult<SecretResult>;

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export type TransportFactory = {
  client<Request, Response>(label: string): ClientTransport<Request, Response>;
  server<Request, Response>(label: string): ServerTransport<Request, Response>;
};
