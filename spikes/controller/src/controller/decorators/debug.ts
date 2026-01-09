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
    target: ClassAccessorDecoratorTarget<Context, Value>,
    context: ClassAccessorDecoratorContext<Context, Value>
  ) {
    context.addInitializer(function (this: Context) {
      if (typeof this !== "object") return;
      if (this === null) return;

      const section = debugContextPaths.get(this.constructor) ?? "";
      const path = `${section}/${String(context.name)}`;
      if (debugContextValues.get(path)) {
        console.warn(`[Debug] Item already exists at ${path}`);
      }

      debugContextValues.set(path, {
        config,
        // We bind the target methods to the current 'this' instance
        binding: {
          get: () => target.get.call(this),
          set: (v: Value) => target.set.call(this, v),
        },
      });
    });
  };
}
