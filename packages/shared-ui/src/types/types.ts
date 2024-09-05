/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Schema,
  InspectableEdgeType,
  InspectableEdge,
  PortStatus,
  NodeValue,
  NodeConfiguration,
  NodeDescriptor,
  InputValues,
  ErrorResponse,
} from "@google-labs/breadboard";

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

export type InputCallback = (data: Record<string, unknown>) => void;

export type Board = {
  title: string;
  url: string;
  version: string;
};

export enum STATUS {
  RUNNING = "running",
  PAUSED = "paused",
  STOPPED = "stopped",
}

export type UserInputConfiguration = {
  name: string;
  title: string;
  secret: boolean;
  required?: boolean;
  configured?: boolean;
  value?: NodeValue;
  schema?: Schema;
  status?: PortStatus;
  type?: Schema["type"];
};

export type UserOutputValues = NodeConfiguration;

export interface AllowedLLMContentTypes {
  audioFile: boolean;
  audioMicrophone: boolean;
  videoFile: boolean;
  videoWebcam: boolean;
  imageFile: boolean;
  imageWebcam: boolean;
  imageDrawable: boolean;
  textFile: boolean;
  textInline: boolean;
}

export enum SETTINGS_TYPE {
  SECRETS = "Secrets",
  GENERAL = "General",
  INPUTS = "Inputs",
  NODE_PROXY_SERVERS = "Node Proxy Servers",
  CONNECTIONS = "Connections",
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
  [SETTINGS_TYPE.INPUTS]: SettingEntry;
  [SETTINGS_TYPE.NODE_PROXY_SERVERS]: SettingEntry;
  [SETTINGS_TYPE.CONNECTIONS]: SettingEntry;
}

export type SettingsItems = Map<
  SettingEntry["value"]["name"],
  SettingEntry["value"]
>;

export type Settings = {
  [K in keyof SettingsList]: {
    configuration: {
      extensible: boolean;
      description: string;
      nameEditable: boolean;
      nameVisible: boolean;
      /**
       * Render an instance of the custom element with this name, instead of
       * generic setting entries. The element must match the
       * {@link CustomSettingsElement} interface.
       */
      customElement?: string;
    };
    items: SettingsItems;
  };
};

export type CustomSettingsElement = HTMLElement & {
  settingsType?: SETTINGS_TYPE | undefined;
  settingsItems?: Settings[SETTINGS_TYPE]["items"] | undefined;
};

/**
 * A simplified interface over {@link SettingsStore} that reads/writes
 * immediately and can be consumed by elements using
 * {@link settingsHelperContext}.
 */
export interface SettingsHelper {
  get(section: SETTINGS_TYPE, name: string): SettingEntry["value"] | undefined;
  set(
    section: SETTINGS_TYPE,
    name: string,
    value: SettingEntry["value"]
  ): Promise<void>;
  delete(section: SETTINGS_TYPE, name: string): Promise<void>;
}

/**
 * A POJO version of {@link InspectableEdge} with only what we need for
 * rendering. An {@link InspectableEdge} should be assignable to this, but not
 * vice-versa.
 *
 * This type was created to distinguish when we have an actual
 * {@link InspectableEdge} with methods and full inspectable nodes, vs a plain
 * object that just has the basic string data.
 *
 * Note that it's not safe to `structuredClone` an {@link InspectableEdge}, so
 * {@link cloneEdgeData} should be used for cloning.
 */
export interface EdgeData {
  from: { descriptor: { id: string } };
  to: { descriptor: { id: string } };
  out: string;
  in: string;
  type: InspectableEdgeType;
}

({}) as InspectableEdge satisfies EdgeData;

export function cloneEdgeData<T extends EdgeData | null>(edge: T): T {
  return (
    edge === null
      ? null
      : {
          from: { descriptor: { id: edge.from.descriptor.id } },
          to: { descriptor: { id: edge.to.descriptor.id } },
          out: edge.out,
          in: edge.in,
          type: edge.type,
        }
  ) as T;
}

export interface RecentBoard {
  title: string;
  url: string;
}

export interface SettingsStore {
  values: Settings;
  getSection(section: SETTINGS_TYPE): Settings[typeof section];
  getItem(section: SETTINGS_TYPE, name: string): void;
  save(settings: Settings): Promise<void>;
  restore(): Promise<void>;
}

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

/**
 * The result, returned by the TopGraphObserver, containing the activity log
 * for the graph's run.
 */
export type TopGraphRunResult = {
  log: LogEntry[];
};
