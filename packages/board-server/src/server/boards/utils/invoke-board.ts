/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDefaultDataStore } from "@breadboard-ai/data-store";
import { run, type HarnessRunResult } from "@google-labs/breadboard/harness";
import { createKits } from "./create-kits.js";
import { createLoader, inflateData } from "@google-labs/breadboard";
import { BoardServerProvider } from "./board-server-provider.js";
import { formatRunError } from "./format-run-error.js";
import type { InvokeBoardArguments } from "../../types.js";

export const invokeBoard = async ({
  url,
  path,
  inputs,
  loader,
  kitOverrides,
}: InvokeBoardArguments) => {
  const store = getDefaultDataStore();
  if (!store) {
    return;
  }

  const runner = run({
    url,
    kits: createKits(kitOverrides),
    loader: createLoader([new BoardServerProvider(path, loader)]),
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
