/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
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
  start: number;
  bubbled: boolean;
  end: number | null;
  title(): string;
};

export type EdgeLogEntry = {
  type: "edge";
  id?: string;
  end: number | null;
  schema?: Schema;
  value?: InputValues;
};

export type ErrorLogEntry = {
  type: "error";
  error: ErrorResponse["error"];
};

export type LogEntry = NodeLogEntry | EdgeLogEntry | ErrorLogEntry;
