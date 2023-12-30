/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@google-labs/breadboard";

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

export type HistoryEvent = {
  summary?: string;
  id?: string;
  data?: unknown;
};

export type DoneHistoryEvent = HistoryEvent & {
  type: HistoryEventType.DONE;
};
export type ErrorHistoryEvent = HistoryEvent & {
  type: HistoryEventType.ERROR;
};
export type SecretsHistoryEvent = HistoryEvent & {
  type: HistoryEventType.SECRETS;
};

export type InputHistoryEvent = HistoryEvent & {
  type: HistoryEventType.INPUT;
  data: {
    args: InputArgs;
    response: Record<string, unknown>;
  };
};

export type LoadHistoryEvent = HistoryEvent & {
  type: HistoryEventType.LOAD;
  data: { url: string };
};

export type OutputHistoryEvent = HistoryEvent & {
  type: HistoryEventType.OUTPUT;
  data: { outputs: { schema?: Schema } & Record<string, unknown> };
};

export type DataWithPath = {
  path: number[];
};

export type GraphStartHistoryEvent = HistoryEvent & {
  type: HistoryEventType.GRAPHSTART;
  data: DataWithPath;
};

export type GraphEndHistoryEvent = HistoryEvent & {
  type: HistoryEventType.GRAPHEND;
  data: DataWithPath;
};

export type NodeStartHistoryEvent = HistoryEvent & {
  type: HistoryEventType.NODESTART;
  data: DataWithPath;
};

export type NodeEndHistoryEvent = HistoryEvent & {
  type: HistoryEventType.NODEEND;
  data: DataWithPath & { outputs: Record<string, unknown> };
};

export type AnyHistoryEvent =
  | DoneHistoryEvent
  | ErrorHistoryEvent
  | InputHistoryEvent
  | OutputHistoryEvent
  | SecretsHistoryEvent
  | GraphStartHistoryEvent
  | GraphEndHistoryEvent
  | NodeStartHistoryEvent
  | NodeEndHistoryEvent
  | LoadHistoryEvent;

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
