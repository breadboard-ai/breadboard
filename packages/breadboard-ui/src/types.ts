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
  BEFOREHANDLER = "beforehandler",
  AFTERHANDLER = "afterhandler",
  RESULT = "result",
  SECRETS = "secrets",
  GRAPHSTART = "graphstart",
  GRAPHEND = "graphend",
}

// TODO: Remove all the `Loose` types by tightening up the types for
// each event.
export type LooseHistoryEventTypes = Exclude<
  HistoryEventType,
  | HistoryEventType.DONE
  | HistoryEventType.ERROR
  | HistoryEventType.INPUT
  | HistoryEventType.GRAPHEND
  | HistoryEventType.GRAPHSTART
  | HistoryEventType.BEFOREHANDLER
  | HistoryEventType.AFTERHANDLER
>;

export type PrimordialHistoryEvent = {
  type: HistoryEventType;
  summary?: string;
  id?: string | null;
  data?: unknown;
};

export type LooseHistoryEvent = PrimordialHistoryEvent & {
  type: LooseHistoryEventTypes;
};

export type SimpleHistoryEvent = PrimordialHistoryEvent & {
  summary: string;
};

export type DoneHistoryEvent = SimpleHistoryEvent & {
  type: HistoryEventType.DONE;
};
export type ErrorHistoryEvent = SimpleHistoryEvent & {
  type: HistoryEventType.ERROR;
};

export type InputHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.INPUT;
  data: {
    args: InputArgs;
    response: Record<string, unknown>;
  };
};

export type DataWithPath = {
  path: number[];
};

export type GraphStartHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.GRAPHSTART;
  data: DataWithPath;
};

export type GraphEndHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.GRAPHEND;
  data: DataWithPath;
};

export type BeforehandlerHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.BEFOREHANDLER;
  data: DataWithPath;
};

export type AfterhandlerHistoryEvent = PrimordialHistoryEvent & {
  type: HistoryEventType.AFTERHANDLER;
  data: DataWithPath & { outputs: Record<string, unknown> };
};

export type HistoryEvent =
  | DoneHistoryEvent
  | ErrorHistoryEvent
  | InputHistoryEvent
  | LooseHistoryEvent
  | GraphStartHistoryEvent
  | GraphEndHistoryEvent
  | BeforehandlerHistoryEvent
  | AfterhandlerHistoryEvent;

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
