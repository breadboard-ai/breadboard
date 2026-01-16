/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Signal } from "@lit-labs/signals";
import type { pending } from "./utils/sentinel.js";
import { type BaseBladeParams } from "tweakpane";

export type PrimitiveType =
  | Record<string, unknown>
  | boolean
  | string
  | number
  | symbol
  | null
  | string[]
  | number[]
  | boolean[];

export type PrimitiveValue = PrimitiveType | null | pending;

export interface Storage {
  get<T extends PrimitiveType>(name: string): Promise<T | null>;
  set<T extends PrimitiveType>(name: string, value: T): Promise<void>;
  clear(): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface HydratedController {
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
  args: any[];
}

export interface DebugHost {
  error(...args: any[]): DebugLog;
  info(...args: any[]): DebugLog;
  warning(...args: any[]): DebugLog;
  verbose(...args: any[]): DebugLog;
}

export interface DebugParams<Value> {
  ui?: BaseBladeParams;
  log?:
    | boolean
    | {
        label?: string;
        format(v: Value, host: DebugHost): DebugLog;
      };
}
