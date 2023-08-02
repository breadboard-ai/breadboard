/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateMessageRequest,
  GenerateTextRequest,
  EmbedTextRequest,
} from "./types.js";
import { models } from "./models.js";

const ENDPOINT_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

type PalmApiKey = string;

type PaLMRequest =
  | GenerateMessageRequest
  | GenerateTextRequest
  | EmbedTextRequest;

type ModelInfo = Record<string, Array<{ name: string }>>;

export enum PalmModelMethod {
  GenerateMessage = "generateMessage",
  GenerateText = "generateText",
  EmbedText = "embedText",
}

const getModelId = (method: string): string => {
  return (models as ModelInfo)[method][0].name;
};

const prepareRequest = (
  key: PalmApiKey,
  method: string,
  request: PaLMRequest,
  model?: string
): Request => {
  if (!model) model = getModelId(method);
  const url = `${ENDPOINT_URL}/${model}:${method}?key=${key}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
};

class PaLM {
  private key: PalmApiKey;

  constructor(PALM_KEY: PalmApiKey) {
    this.key = PALM_KEY;
  }

  /**
   * Produces the `Request` object for the PaLM API `generateMessage` method. The produced object can be supplied directly to `fetch` method.
   * @param request `GenerateMessageRequest` object.
   * @param model Optional model name. If not supplied, the first model in the list of models that support `generateMessage` will be used.
   * @returns a `Request` object.
   */
  message(request: GenerateMessageRequest, model?: string): Request {
    return prepareRequest(this.key, "generateMessage", request, model);
  }

  /**
   * Produces the `Request` object for the PaLM API `generateText` method. The produced object can be supplied directly to `fetch` method.
   * @param request `GenerateTextRequest` object.
   * @param model Optional model name. If not supplied, the first model in the list of models that support `generateText` will be used.
   * @returns a `Request` object.
   */
  text(request: GenerateTextRequest, model?: string): Request {
    return prepareRequest(this.key, "generateText", request, model);
  }

  /**
   * Produces the `Request` object for the PaLM API `embedText` method. The produced object can be supplied directly to `fetch` method.
   * @param request `EmbedTextRequest` object.
   * @param model Optional model name. If not supplied, the first model in the list of models that support `embedText` will be used.
   * @returns a `Request` object.
   */
  embedding(request: EmbedTextRequest, model?: string): Request {
    return prepareRequest(this.key, "embedText", request, model);
  }

  /**
   * Returns the id, including name and version, of the model used.
   * @param method PaLM API method, from @enum ModelMethod.
   * @returns a string representing the model id.
   */
  getModelId(method: PalmModelMethod): string {
    return getModelId(method);
  }
}

/**
 * The entry point into the `palm-lite` library. Usage:
 * ```typescript
 * import { palm } from "palm-lite";
 *
 * // Make sure to set the PALM_KEY environment variable.
 * const PALM_KEY = process.env.PALM_KEY;
 * const request = palm(PALM_KEY).message({
 *   prompt: {
 *     messages: [ { content: "Hello there!" } ],
 *   },
 * });
 * const data = await fetch(request);
 * const response = await data.json();
 * console.log(response.candidates[0].content);
 * ```
 * @param apiKey PaLM API key
 * @returns Returns an object that lets you make `message`, `text`, and `embedding` request to PaLM API.
 */
export const palm = (apiKey: PalmApiKey): PaLM => new PaLM(apiKey);

export * from "./chat.js";
export * from "./types.js";
export * from "./text.js";
