/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { GraphProvider, GraphProviderCapabilities } from "./types.js";

export const loadFromFile = async (path: string) => {
  if (typeof globalThis.process === "undefined")
    throw new Error("Unable to use `path` when not running in node");
  let readFileFn;
  // The CJS transpilation process for node/vscode seems to miss this import,
  // and leaves it as an import statement rather than converting it to a
  // require. We therefore need a runtime check that prefers `require` if it
  // is available.
  if (typeof require === "function") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFile } = require("node:fs/promises");
    readFileFn = readFile;
  } else {
    const { readFile } = await import(/* vite-ignore */ "node:fs/promises");
    readFileFn = readFile;
  }

  return JSON.parse(await readFileFn(path, "utf-8"));
};

export const loadWithFetch = async (url: string | URL) => {
  const response = await fetch(url);
  return await response.json();
};

export class DefaultGraphProvider implements GraphProvider {
  canProvide(url: URL): false | GraphProviderCapabilities {
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { load: true, save: false };
    }
    if (url.protocol === "file:" && url.hostname === "") {
      return { load: true, save: false };
    }
    return false;
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    if (url.protocol === "file:") {
      const path = decodeURIComponent(url.pathname);
      return loadFromFile(path);
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return loadWithFetch(url.href);
    }
    return null;
  }
}
