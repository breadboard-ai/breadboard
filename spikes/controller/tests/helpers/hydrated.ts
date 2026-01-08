/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { effect } from "signal-utils/subtle/microtask-effect";
import { isHydrating } from "../../src/controller/utils/hydration.js";

export function hydrated(args: Array<() => void>) {
  const disposers = new Map<string, () => void>();
  return new Promise((resolve) => {
    const checkAllHydrated = () => {
      if (disposers.size > 0) return;
      resolve(void 0);
    }

    for (const arg of args) {
      const id = globalThis.crypto.randomUUID();
      const callback = () => {
        const val = arg.call(undefined)
        if (isHydrating(val)) {
          return;
        }

        const dispose = disposers.get(id);
        if (!dispose) throw new Error('No disposer');
        dispose();
        disposers.delete(id);
        checkAllHydrated();
      }

      disposers.set(id, effect(callback));
    }
  })
}
