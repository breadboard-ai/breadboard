/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphStartProbeData,
  NodeDescriptor,
  NodeEndResponse,
  NodeStartResponse,
  Schema,
} from "@google-labs/breadboard";
import { HarnessRunResult } from "@google-labs/breadboard/harness";

export const enum HistoryEventType {
  DONE = "done",
  ERROR = "error",
  INPUT = "input",
  LOAD = "load",
  OUTPUT = "output",
  NODESTART = "nodestart",
  NODEEND = "nodeend",
  SECRETS = "secrets",
  GRAPHSTART = "graphstart",
  GRAPHEND = "graphend",
}

export type Board = {
  title: string;
  url: string;
  version: string;
};

export type AnyHistoryEvent =
  | GraphStartProbeData
  | NodeStartResponse
  | NodeEndResponse;

export interface ImageHandler {
  start(): Promise<void>;
  stop(): void;
}

export interface CanvasData {
  inline_data: {
    data: string;
    mime_type: string;
  };
}

export type HistoryEntry = HarnessRunResult & {
  id: string;
  guid: string;
  graphNodeData:
    | { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
    | null
    | undefined;
  children: HistoryEntry[];
};

export enum STATUS {
  RUNNING = "running",
  PAUSED = "paused",
  STOPPED = "stopped",
}

export type LoadArgs = {
  title?: string;
  description?: string;
  version?: string;
  diagram?: string;
  graphDescriptor?: GraphDescriptor;
  url?: string;
  nodes?: NodeDescriptor[];
};

export type StartArgs = {
  boards: Board[];
};

export type InputArgs = {
  schema?: Schema;
};

export type OutputArgs = {
  node: {
    id: string;
    type: string;
    configuration?: unknown;
  };
  outputs: {
    schema?: Schema;
  } & Record<string, unknown>;
};
