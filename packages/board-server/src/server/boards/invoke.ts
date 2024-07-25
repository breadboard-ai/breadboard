/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import { createLoader, inflateData } from "@google-labs/breadboard";
import { run, type HarnessRunResult } from "@google-labs/breadboard/harness";
import type { ApiHandler, BoardParseResult } from "../types.js";
import {
  BoardServerProvider,
  loadFromStore,
} from "./utils/board-server-provider.js";
import { createKits } from "./utils/create-kits.js";
import { formatRunError } from "./utils/format-run-error.js";
import { verifyKey } from "./utils/verify-key.js";
import { secretsKit } from "../proxy/secrets.js";

export const invoke = async (
  url: string,
  path: string,
  inputs: Record<string, any>
) => {
  const store = getDataStore();
  if (!store) {
    return;
  }

  const runner = run({
    url,
    kits: createKits([secretsKit]),
    loader: createLoader([new BoardServerProvider(path, loadFromStore)]),
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

const invokeHandler: ApiHandler = async (parsed, req, res, body) => {
  const { board, url } = parsed as BoardParseResult;
  const inputs = body as Record<string, any>;
  const keyVerificationResult = await verifyKey(inputs);
  if (!keyVerificationResult.success) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ $error: keyVerificationResult.error }));
    return true;
  }
  const result = await invoke(url, board, inputs);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
  return true;
};

export default invokeHandler;
