/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppController, type AppServices } from "../types.js";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type ActionBind = {
  controller: AppController;
  services: AppServices;
};

type DefaultBindings = ActionBind;
type Action<T> = ((deps: T) => void) & T;

export function makeAction<T extends DefaultBindings>(): Action<T> {
  let deps: T | undefined;

  const setter = (newDeps: T) => {
    deps = newDeps;
  };

  return new Proxy(setter, {
    get(_target, prop, receiver) {
      if (deps && prop in deps) {
        return Reflect.get(deps, prop, receiver);
      }

      throw new Error("Not set");
    },
  }) as Action<T>;
}
