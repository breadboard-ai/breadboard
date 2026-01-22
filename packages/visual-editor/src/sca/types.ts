/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Signal } from "@lit-labs/signals";
import { type BaseBladeParams } from "tweakpane";
import { NodeIdentifier } from "@breadboard-ai/types";
import { GlobalConfig } from "../ui/contexts/global-config.js";
import {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { SettingsStore } from "../ui/types/types.js";

export interface ServicesConfig {
  globalConfig: GlobalConfig;
  guestConfig: GuestConfiguration;
  shellHost: OpalShellHostProtocol;
  settings: SettingsStore;
  env?: FileSystemEntry[];
  appName: string;
  appSubName: string;
}

export type pending = symbol;

export type AssetIdentifier = string;
export type EdgeIdentifier =
  `${NodeIdentifier}:${string}->${NodeIdentifier}:${string}`;
export type AssetEdgeIdentifier = `${AssetIdentifier}->${NodeIdentifier}`;

export interface DebugController {
  enabled: boolean;
}
export interface DebuggableAppController {
  global: {
    debug: DebugController;
  };
}

export type PrimitiveType =
  | string
  | number
  | boolean
  | null
  | symbol
  | { [key: string]: PrimitiveType }
  | object
  | Map<string, PrimitiveValue>
  | Set<PrimitiveType>
  | PrimitiveType[];

export type PrimitiveValue = PrimitiveType | pending;

export interface Storage {
  get<T extends PrimitiveType>(name: string): Promise<T | null>;
  set<T extends PrimitiveType>(name: string, value: T): Promise<void>;
  clear(): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface HydratedController {
  isHydrated: Promise<number>;
  isSettled: Promise<void[]>;
  registerSignalHydration(signal: Signal.State<unknown>): void;
}

export interface DebugContext {
  foo: number;
}

export interface DebugContainerOpts {
  path: string;
}

export interface DebugBinding<T = any> {
  get: () => T;
  set: (value: T) => void;
}

export interface DebugEntry {
  config: BaseBladeParams;
  binding: DebugBinding;
}

export interface DebugLog {
  type: "error" | "info" | "warning" | "verbose";
  args: string[];
}

export interface DebugFormatter {
  error(...args: unknown[]): DebugLog;
  info(...args: unknown[]): DebugLog;
  warning(...args: unknown[]): DebugLog;
  verbose(...args: unknown[]): DebugLog;
}

export interface DebugParams<Value> {
  ui?: BaseBladeParams;
  log?:
    | boolean
    | {
        label?: string;
        format(v: Value, host: DebugFormatter): DebugLog;
      };
}
