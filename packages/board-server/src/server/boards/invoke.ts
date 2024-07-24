/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asRuntimeKit,
  createLoader,
  inflateData,
  type ChangeNotificationCallback,
  type GraphDescriptor,
  type GraphProvider,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderStore,
  type KitManifest,
} from "@google-labs/breadboard";
import type { ApiHandler, BoardParseResult } from "../types.js";
import { run, type HarnessRunResult } from "@google-labs/breadboard/harness";
import { fromManifest } from "@google-labs/breadboard/kits";
import AgentKit from "@google-labs/agent-kit/agent.kit.json" with { type: "json" };
import GeminiKit from "@google-labs/gemini-kit";
import TemplateKit from "@google-labs/template-kit";
import JSONKit from "@google-labs/json-kit";
import Core from "@google-labs/core-kit";
import { asInfo, getStore } from "../store.js";
import { secretsKit } from "../proxy/secrets.js";
import { getDataStore } from "@breadboard-ai/data-store";

class BoardServerProvider implements GraphProvider {
  #path: string;

  name = "Board Server Provider";

  constructor(path: string) {
    this.#path = path;
  }

  async ready(): Promise<void> {
    return;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    return url.href.endsWith(this.#path)
      ? {
          load: true,
          save: false,
          delete: false,
        }
      : false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const store = getStore();
    const { userStore, boardName } = asInfo(this.#path);
    if (!userStore || !boardName) {
      return null;
    }
    const graph = JSON.parse(await store.get(userStore, boardName));
    return graph as GraphDescriptor;
  }

  async save(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  create(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  delete(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  connect: (location?: string, auth?: unknown) => Promise<boolean> =
    async () => {
      throw new Error("Method not supported.");
    };

  disconnect: (location: string) => Promise<boolean> = async () => {
    throw new Error("Method not supported.");
  };

  refresh: (location: string) => Promise<boolean> = async () => {
    throw new Error("Method not supported.");
  };

  createURL: (location: string, fileName: string) => Promise<string | null> =
    async () => {
      throw new Error("Method not supported.");
    };

  watch: (callback: ChangeNotificationCallback) => void = async () => {
    throw new Error("Method not supported.");
  };

  parseURL(url: URL): { location: string; fileName: string } {
    throw new Error("Method not supported.");
  }

  restore: () => Promise<void> = async () => {
    throw new Error("Method not supported.");
  };

  items: () => Map<string, GraphProviderStore> = () => {
    throw new Error("Method not supported.");
  };

  startingURL: () => URL | null = () => {
    throw new Error("Method not supported.");
  };
}

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
