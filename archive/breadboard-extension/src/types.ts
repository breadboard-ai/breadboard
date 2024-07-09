/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebugProtocol } from "@vscode/debugprotocol";

export interface BreadboardLaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  board: string;
  stopOnEntry: boolean;
  noDebug: boolean;
}

export enum VARIABLE_TYPE {
  BOARD = "board",
  RUN_RESULT = "runresult",
}

export enum DEBUGGER_RUNTIME_EVENTS {
  STOP_ON_ENTRY = "stopOnEntry",
  STOP_ON_STEP = "stopOnStep",
  STOP_ON_BREAKPOINT = "stopOnBreakpoint",
  OUTPUT = "output",
  END = "end",
}

export interface Capability {
  readonly kind: string;
}

export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | Capability
  | { [key: string]: NodeValue };

export type InputIdentifier = string;
export type InputValues = Record<InputIdentifier, NodeValue>;

export type JSONObjectValue = number | string | boolean | JSONObject;
export interface JSONObject {
  [key: string]: JSONObjectValue;
}

export enum RUNTIME_MODE {
  STEP,
  CONTINUE,
  CANCELLED,
}

export type Resolver = (
  value: RUNTIME_MODE | PromiseLike<RUNTIME_MODE>
) => void;

export const BOARD_VARIABLES = 0;
export const RUN_RESULT_VARIABLES = 1;
