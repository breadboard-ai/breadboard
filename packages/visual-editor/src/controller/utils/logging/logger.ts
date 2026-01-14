/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebuggableAppController, DebugLog } from "../../types.js";

let loggerInstance: Logger | null = null;
let debuggableAppController: DebuggableAppController | null = null;
export function setDebuggableAppController(
  appController: DebuggableAppController | null
) {
  debuggableAppController = appController;
}

export function getLogger() {
  if (loggerInstance) return loggerInstance;
  loggerInstance = new Logger();
  return loggerInstance;
}

class Logger {
  private warned = false;
  constructor() {
    if (!debuggableAppController) {
      console.warn("Logger created without app controller");
    }
  }

  log(logMsg: DebugLog, label = "") {
    this.logItem(logMsg.type, "", label, ...logMsg.args);
  }

  logItem(
    type: "info" | "warning" | "error" | "verbose",
    fn: "get" | "set" | "",
    name: string,
    ...args: unknown[]
  ) {
    if (!debuggableAppController && !this.warned) {
      this.warned = true;
      console.warn("Logger called without app controller");
    }

    if (debuggableAppController) {
      if (!debuggableAppController.debug.enabled) return;
      if (type === "info" && !debuggableAppController.debug.info) return;
      if (type === "warning" && !debuggableAppController.debug.warnings) return;
      if (type === "error" && !debuggableAppController.debug.errors) return;
      if (type === "verbose" && !debuggableAppController.debug.verbose) return;
    }

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
      default:
        code = "\x1B[107;30m";
        break;
    }

    method.call(
      console,
      `[${code} ${name}${fn ? `:${fn}` : ""} ${end}]`,
      ...args
    );
  }
}
