/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { debugGlobalLogLevel } from "../../context/debug.js";
import { DebugHost, DebugLog } from "../../types.js";

export function log(
  type: "info" | "warning" | "error" | "verbose",
  name: string,
  ...args: any[]
) {
  const end = "\x1B[m";
  let code;
  let method = console.log;
  switch (type) {
    case "warning":
      code = "\x1B[43;97m";
      method = console.warn;
      break;
    case "error":
      code = "\x1B[41;97m";
      method = console.error;
      break;
    case "info":
      code = "\x1B[104;97m";
      break;
    default:
      code = "\x1B[107;30m";
      break;
  }

  if (type === "info" && !debugGlobalLogLevel.levels.info) return;
  if (type === "warning" && !debugGlobalLogLevel.levels.warnings) return;
  if (type === "error" && !debugGlobalLogLevel.levels.errors) return;
  if (type === "verbose" && !debugGlobalLogLevel.levels.verbose) return;

  method.call(console, `[${code} ${name} ${end}]`, ...args);
}

class Logger implements DebugHost {
  error(...args: any[]): DebugLog {
    return { type: "error", args };
  }

  info(...args: any[]): DebugLog {
    return { type: "info", args };
  }

  verbose(...args: any[]): DebugLog {
    return { type: "verbose", args };
  }

  warning(...args: any[]): DebugLog {
    return { type: "warning", args };
  }
}

export const logger = new Logger();
