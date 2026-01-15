/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebugLog } from "../../types.js";

export function error(...args: unknown[]): DebugLog {
  return { type: "error", args } as DebugLog;
}

export function info(...args: unknown[]): DebugLog {
  return { type: "info", args } as DebugLog;
}

export function verbose(...args: unknown[]): DebugLog {
  return { type: "verbose", args } as DebugLog;
}

export function warning(...args: unknown[]): DebugLog {
  return { type: "warning", args } as DebugLog;
}
