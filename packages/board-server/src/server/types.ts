/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import type {
  GraphDescriptor,
  InputValues,
  Kit,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";

export type GeneralRequestType = "list" | "create";

export type UserRequestType =
  | "list"
  | "create"
  | "get"
  | "update"
  | "app"
  | "api"
  | "invoke"
  | "describe"
  | "run";

export type RequestType = GeneralRequestType | UserRequestType;

export type GeneralParseResult = {
  success: true;
  type: GeneralRequestType;
};

export type BoardParseResult = {
  success: true;
  type: UserRequestType;
  board: string;
  url: string;
  user: string;
  name: string;
};

export type ParseResult =
  | GeneralParseResult
  | BoardParseResult
  | { success: false; error: string; code: number };

export type ApiHandler = <T extends ParseResult>(
  parsed: T,
  req: IncomingMessage,
  res: ServerResponse,
  body?: unknown
) => Promise<boolean>;

export type SecretInputs = {
  keys: string[];
};

export type BoardServerLoadFunction = (
  path: string
) => Promise<GraphDescriptor | null>;

export type InvokeBoardArguments = {
  url: string;
  path: string;
  loader: BoardServerLoadFunction;
  inputs: Record<string, any>;
  kitOverrides?: Kit[];
};

export type RunBoardArguments = {
  url: string;
  path: string;
  loader: BoardServerLoadFunction;
  inputs?: InputValues;
  kitOverrides?: Kit[];
  next?: string;
};

export type RunBoardResultError = {
  $error: string;
};

export type RunBoardResultState = {
  outputs: OutputValues[];
  $state:
    | {
        type: "input";
        schema: NodeValue;
        next: string;
      }
    | {
        type: "end";
      };
};

export type RunBoardResult = RunBoardResultError | RunBoardResultState;
