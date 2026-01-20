/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebugParams } from "../types.js";
import { getLogger } from "../utils/logging/logger.js";
import * as LogFormatter from "../utils/logging/formatter.js";

declare const ENABLE_DEBUG_TOOLING: boolean;

export function debug<Context, Value>(opts: DebugParams<Value> = { ui: {} }) {
  if (typeof ENABLE_DEBUG_TOOLING !== "undefined" && !ENABLE_DEBUG_TOOLING) {
    return () => {};
  }

  type Getter = (this: Context) => Value;
  type Setter = (this: Context, value: Value) => void;

  type DecoratorContext<T> = T extends Getter
    ? ClassGetterDecoratorContext<Context, Value>
    : T extends Setter
      ? ClassSetterDecoratorContext<Context, Value>
      : never;

  function decorator<T extends Getter | Setter>(
    target: T,
    context: DecoratorContext<T>
  ): T | void {
    const propertyName = String(context.name);
    const label = propertyName;

    // Handle Getter Logic.
    if (context.kind === "getter") {
      return function (this: Context): Value {
        const value = (target as (this: Context) => Value).call(this);

        if (opts.log) {
          const logger = getLogger();
          if (typeof opts.log === "boolean") {
            logger.logItem("info", "get", label, true, value);
          } else {
            const logMsg = opts.log.format(value, LogFormatter);
            const logLabel = opts.log.label ?? label;
            logger.logItem(logMsg.type, "get", logLabel, true, ...logMsg.args);
          }
        }
        return value;
      } as T;
    }

    // Handle Setter Logic.
    if (context.kind === "setter") {
      return function (this: Context, value: Value) {
        (target as (this: Context, v: Value) => void).call(this, value);

        if (opts.log) {
          const logger = getLogger();
          if (typeof opts.log === "boolean") {
            logger.logItem("info", "set", label, true, value);
          } else {
            const logMsg = opts.log.format(value, LogFormatter);
            const logLabel = opts.log.label ?? label;
            logger.logItem(logMsg.type, "set", logLabel, true, ...logMsg.args);
          }
        }
      } as T;
    }
  }

  return decorator;
}
