/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OPAL_BACKEND_API_PREFIX, Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { GeminiBody } from "./gemini.js";

export { createCachedContent };

const ENDPOINT = "/v1beta1/createCachedContent";

type CachedContent = {
  contents: GeminiBody["contents"];
  tools?: GeminiBody["tools"];
  toolConfig?: GeminiBody["toolConfig"];
  systemInstruction?: GeminiBody["systemInstruction"];
  model: string;
};

type CreateCachedContentRequest = {
  cachedContent: CachedContent;
};

type CreateCachedContentResponse = {
  cachedContent: CachedContent & { name: string };
  errorMessage?: string;
};

/**
 * Creates a cached content resource via the backend's CreateCachedContent RPC.
 *
 * The backend hides the Gemini API key behind OAuth — the call is
 * authenticated with the user's access token via `fetchWithCreds`.
 *
 * @returns The cache resource name (e.g. `cachedContents/abc123`) on
 * success, or an error outcome.
 */
async function createCachedContent(
  moduleArgs: A2ModuleArgs,
  model: string,
  body: GeminiBody
): Promise<Outcome<string>> {
  const { fetchWithCreds, context } = moduleArgs;
  const url = new URL(ENDPOINT, OPAL_BACKEND_API_PREFIX);

  const request: CreateCachedContentRequest = {
    cachedContent: {
      model: `models/${model}`,
      contents: body.contents,
      tools: body.tools,
      toolConfig: body.toolConfig,
      systemInstruction: body.systemInstruction,
    },
  };

  try {
    const response = await fetchWithCreds(url, {
      method: "POST",
      body: JSON.stringify(request),
      signal: context.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      return err(`CreateCachedContent failed (${response.status}): ${text}`);
    }
    const json = (await response.json()) as CreateCachedContentResponse;
    if (json.errorMessage) {
      return err(`CreateCachedContent: ${json.errorMessage}`);
    }
    if (!json.cachedContent?.name) {
      return err(
        `CreateCachedContent: no cache name in response: ${JSON.stringify(json)}`
      );
    }
    return json.cachedContent.name;
  } catch (e) {
    return err((e as Error).message);
  }
}
