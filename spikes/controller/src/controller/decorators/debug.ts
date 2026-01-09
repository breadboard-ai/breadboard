/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type BaseBladeParams } from "tweakpane";
import { debugContextPaths, debugContextValues } from "../context/debug.js";
import { DebugContainerOpts } from "../types.js";

export function debugContainer(opts: DebugContainerOpts) {
  return function <T>(target: T, _context: ClassDecoratorContext) {
    debugContextPaths.set(target, opts.path);
    return target;
  };
}

export function debug(config: BaseBladeParams = {}) {
  return function <Context, Value>(
    target: (this: Context) => Value,
    context: ClassGetterDecoratorContext<Context, Value>
  ) {
    context.addInitializer(function (this: Context) {
      if (typeof this !== "object") return;
      if (this === null) return;

      const section = debugContextPaths.get(this.constructor) ?? "";
      const propertyName = String(context.name);
      const path = `${section}/${String(context.name)}`;
      debugContextValues.set(path, {
        config,
        binding: {
          get: () => target.call(this),
          set: (v: Value) => {
            // Dynamically call the setter for this property name
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any)[propertyName] = v;
          },
        },
      });
    });
  };
}
