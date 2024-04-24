/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphStartProbeData,
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

type InlineData = {
  inline_data: { data: string; mime_type: string };
};

type FunctionCall = {
  functionCall: {
    name: string;
    args: object;
  };
};

type FunctionResponse = {
  functionResponse: {
    name: string;
    response: object;
  };
};

type Part = InlineData | FunctionCall | FunctionResponse;

export type LLMContent = {
  role?: string;
  parts: Part[];
};

export enum SETTINGS_TYPE {
  SECRETS = "Secrets",
  GENERAL = "General",
}

export interface SettingEntry {
  key: string;
  value: {
    id?: string;
    name: string;
    description?: string;
    value: string | number | boolean;
  };
}

export interface SettingsList {
  [SETTINGS_TYPE.GENERAL]: SettingEntry;
  [SETTINGS_TYPE.SECRETS]: SettingEntry;
}

export type Settings = {
  [K in keyof SettingsList]: {
    configuration: {
      extensible: boolean;
      description: string;
      nameEditable: boolean;
    };
    items: Map<SettingEntry["value"]["name"], SettingEntry["value"]>;
  };
};
