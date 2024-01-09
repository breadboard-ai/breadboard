/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphProbeMessageData, Schema } from "@google-labs/breadboard";
import { AnyRunResult, NodeEndResponse } from "@google-labs/breadboard/harness";
import { NodeStartResponse } from "@google-labs/breadboard/remote";

export type InputArgs = {
  schema?: Schema;
};

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
  | GraphProbeMessageData
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

export type HistoryEntry = {
  id: string;
  guid: string;
  type: AnyRunResult["type"];
  graphNodeId: string;
  graphNodeType: string;
  data:
    | { inputs: Record<string, unknown>; outputs: Record<string, unknown> }
    | null
    | undefined;
  elapsedTime: number;
  children: HistoryEntry[];
};
