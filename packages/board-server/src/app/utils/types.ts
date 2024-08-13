/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  ErrorResponse,
  InputValues,
  NodeDescriptor,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";

export type NodeLogEntry = {
  type: "node";
  id: string;
  descriptor: NodeDescriptor;
  hidden: boolean;
  outputs: OutputValues | null;
  inputs: InputValues;
  start: number;
  bubbled: boolean;
  end: number | null;
  title(): string;
};

export type EdgeLogEntry = {
  type: "edge";
  schema?: Schema;
  value?: InputValues;
};

export type ErrorLogEntry = {
  type: "error";
  error: ErrorResponse["error"];
};

export type SecretLogEntry = {
  type: "secret";
  keys: string[];
  start: number;
  end: number | null;
};

export type LogEntry =
  | NodeLogEntry
  | EdgeLogEntry
  | ErrorLogEntry
  | SecretLogEntry;
