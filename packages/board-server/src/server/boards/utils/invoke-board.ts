/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import { run, type HarnessRunResult } from "@google-labs/breadboard/harness";
import { createKits, registerLegacyKits } from "./create-kits.js";
import {
  createGraphStore,
  createLoader,
  inflateData,
  StubFileSystem,
} from "@google-labs/breadboard";
import { BoardServerProvider } from "./board-server-provider.js";
import { formatRunError } from "./format-run-error.js";
import type { InvokeBoardArguments } from "../../types.js";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";

export const invokeBoard = async ({
  url,
  path,
  inputs,
  loader,
  kitOverrides,
  serverUrl,
}: InvokeBoardArguments) => {
  const store = getDataStore();
  if (!store) {
    return;
  }
  // TODO: Figure out if this is the right thing to do here.
  store.createGroup("run-board");

  const invokeKits = createKits(kitOverrides);
  const boardServerProvider = new BoardServerProvider(serverUrl, path, loader);
  await boardServerProvider.ready();

  const invokeLoader = createLoader([boardServerProvider]);
  const graphStore = createGraphStore({
    loader: invokeLoader,
    kits: invokeKits,
    sandbox: new NodeSandbox(),
    fileSystem: new StubFileSystem(),
  });
  registerLegacyKits(graphStore);

  const runner = run({
    url,
    kits: invokeKits,
    loader: invokeLoader,
    graphStore,
    store,
    inputs: { model: "gemini-1.5-flash-latest" },
    interactiveSecrets: false,
  });

  for await (const result of runner) {
    const { type, data, reply } = result as HarnessRunResult;
    if (type === "input") {
      await reply({ inputs });
    } else if (type === "output") {
      return inflateData(store, data.outputs);
    } else if (type === "error") {
      return {
        $error: formatRunError(data.error),
      };
    } else if (type === "end") {
      return {
        $error: "Run completed without producing output.",
      };
    } else {
      console.log("UNKNOWN RESULT", type, data);
    }
  }
  return {
    $error: "Run completed without signaling end or error.",
  };
};
