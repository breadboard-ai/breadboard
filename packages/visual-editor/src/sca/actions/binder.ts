/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController } from "../controller/controller.js";
import { type AppServices } from "../services/services.js";

type DefaultBindings = {
  controller: AppController;
  services: AppServices;
};

/**
 * Defines the hybrid type:
 * 1. It is a function that accepts the dependencies (Setter).
 * 2. It holds the dependencies as properties (Getter).
 */
type Action<T> = ((deps: T) => void) & T;

export function makeAction<T extends DefaultBindings>(): Action<T> {
  let deps: T | undefined;

  const setter = (newDeps: T) => {
    deps = newDeps;
  };

  // This intercepts property access like `bind.controller` and either returns
  // or throws if the values are not set.
  return new Proxy(setter, {
    get(_target, prop, receiver) {
      if (deps && prop in deps) {
        return Reflect.get(deps, prop, receiver);
      }

      throw new Error("Not set");
    },
  }) as Action<T>;
}
