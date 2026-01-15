/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  debugContextPaths,
  debugContextValues,
  debugGlobalLogLevel,
} from "../context/debug.js";
import { DebugContainerOpts, DebugParams } from "../types.js";
import { log, logger } from "./logging/log.js";

export function debugContainer(opts: DebugContainerOpts) {
  return function <T>(target: T, _context: ClassDecoratorContext) {
    debugContextPaths.set(target, opts.path);
    return target;
  };
}

export function debug<Context, Value>(
  opts: DebugParams<Value> = {
    ui: {},
  }
) {
  return function (
    target: (this: Context) => Value,
    context: ClassGetterDecoratorContext<Context, Value>
  ) {
    context.addInitializer(function (this: Context) {
      if (typeof this !== "object") return;
      if (this === null) return;

      // Store any tags.
      let targetName = String(context.name);
      if (opts.log) {
        if (typeof opts.log !== "boolean" && opts.log.label) {
          targetName = opts.log.label;
        }
        debugGlobalLogLevel.availableTags.add(targetName);
      }

      const section = debugContextPaths.get(this.constructor) ?? "";
      const propertyName = String(context.name);
      const path = `${section}/${String(context.name)}`;
      debugContextValues.set(path, {
        config: opts.ui ?? {},
        binding: {
          get: () => target.call(this),
          set: (v: Value) => {
            // Dynamically call the setter for this property name
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any)[propertyName] = v;

            if (opts.log) {
              const loggableValue = target.call(this);
              if (typeof opts.log === "boolean") {
                log("info", targetName, loggableValue);
              } else if (opts.log) {
                const logMsg = opts.log.format(loggableValue, logger);
                log(logMsg.type, targetName, ...logMsg.args);
              }
            }
          },
        },
      });
    });
  };
}
