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

export const stubAppController: DebuggableAppController = {
  global: {
    debug: {
      enabled: true,
    },
  },
};

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

  log(logMsg: DebugLog, label = "", checkDebuggableAppControllerStatus = true) {
    this.logItem(
      logMsg.type,
      "",
      label,
      checkDebuggableAppControllerStatus,
      ...logMsg.args
    );
  }

  logItem(
    type: "info" | "warning" | "error" | "verbose",
    fn: "get" | "set" | "",
    name: string,
    checkDebuggableAppControllerStatus = true,
    ...args: unknown[]
  ) {
    if (checkDebuggableAppControllerStatus) {
      if (!debuggableAppController && !this.warned) {
        this.warned = true;
        console.warn("Logger called without app controller");
      }

      if (
        debuggableAppController &&
        !debuggableAppController.global.debug.enabled
      ) {
        return;
      }
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
      case "verbose":
        code = "\x1B[42;97m";
        method = console.debug;
        break;
    }

    method.call(
      console,
      `[${code} ${name}${fn ? `:${fn}` : ""} ${end}]`,
      ...args
    );
  }
}
