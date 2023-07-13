/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitDescriptor } from "@google-labs/graph-runner";
import { Kit } from "./types.js";

const urlToNpmSpec = (url: string): string => {
  const urlObj = new URL(url);
  if (urlObj.protocol !== "npm:") {
    throw new Error(`URL protocol must be "npm:"`);
  }
  return urlObj.pathname;
};

export class KitLoader {
  #kits: KitDescriptor[];
  constructor(kits?: KitDescriptor[]) {
    this.#kits = kits ?? [];
  }

  async load(): Promise<Kit[]> {
    return Promise.all(
      this.#kits.map(async (kit) => {
        // TODO: Support `using` property.
        const { url } = kit;
        // TODO: Support protocols other than `npm:`.
        const spec = urlToNpmSpec(url);
        console.log("SPEC", spec);
        const module = await import(spec);
        // TODO: Check to see if this import is actually a Kit class.
        console.log("MODULE", module);
        return module;
      })
    );
  }
}
