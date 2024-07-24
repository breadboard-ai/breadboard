/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import AgentKit from "@google-labs/agent-kit/agent.kit.json" with { type: "json" };
import {
  asRuntimeKit,
  createLoader,
  inflateData,
  type KitManifest,
} from "@google-labs/breadboard";
import { run, type HarnessRunResult } from "@google-labs/breadboard/harness";
import { fromManifest } from "@google-labs/breadboard/kits";
import Core from "@google-labs/core-kit";
import GeminiKit from "@google-labs/gemini-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import { secretsKit } from "../proxy/secrets.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";
import { BoardServerProvider } from "./utils/board-server-provider.js";

const kits = [
  secretsKit,
  asRuntimeKit(Core),
  asRuntimeKit(JSONKit),
  asRuntimeKit(TemplateKit),
  asRuntimeKit(GeminiKit),
  fromManifest(AgentKit as KitManifest),
];

const formatRunError = (e: unknown) => {
  if (typeof e === "string") {
    return e;
  }
  if (e instanceof Error) {
    return e.message;
  }
  if ("message" in (e as any)) {
    return (e as { message: string }).message;
  }
  // Presume it's an ErrorObject.
  const error = (e as { error: unknown }).error;
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
};

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
    kits,
    loader: createLoader([new BoardServerProvider(path)]),
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

const verifyKey = async (inputs: Record<string, any>) => {
  const key = inputs.$key;
  if (!key) {
    return { success: false, error: "No key supplied" };
  }
  const store = getStore();
  const userStore = await store.getUserStore(key);
  if (!userStore.success) {
    return { success: false, error: userStore.error };
  }
  delete inputs.$key;
  return { success: true };
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
