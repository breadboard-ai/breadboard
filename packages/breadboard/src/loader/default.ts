/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { GraphProvider, GraphProviderCapabilities } from "./types.js";
import { loadFromFile, loadWithFetch } from "../loader.js";

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
