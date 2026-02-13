/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console -- This IS the Logger implementation */

import { DebugLog } from "../../types.js";
export * as Formatter from "./formatter.js";

let loggerInstance: Logger | null = null;

// getLogger accepts an optional param for backward compatibility but does not
// use it. Logs are always emitted; DevTools handles level filtering.
export function getLogger(_appController?: unknown) {
  if (loggerInstance) return loggerInstance;
  loggerInstance = new Logger();
  return loggerInstance;
}

class Logger {
  log(logMsg: DebugLog, label = "") {
    let fn = "";
    if (logMsg.type === "group") {
      fn = logMsg.title ?? "";
    }
    this.logItem(logMsg.type, fn, label, ...logMsg.args);
  }

  logItem(
    type: "info" | "warning" | "error" | "verbose" | "group",
    fn: string,
    name: string,
    ...args: unknown[]
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
        method = console.info;
        break;
      case "verbose":
        code = "\x1B[42;97m";
        method = console.debug;
        break;
      case "group":
        code = "\x1B[104;97m";
        method = console.log;
        break;
    }

    const prefix = `[${code} ${name}${fn ? `: ${fn}` : ""} ${end}]`;
    if (type === "group") {
      console.groupCollapsed(prefix);
      method.call(console, ...args);
      console.groupEnd();
      return;
    }
    method.call(console, prefix, ...args);
  }
}
