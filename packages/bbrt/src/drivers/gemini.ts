/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TurnChunk } from "../state/turn-chunk.js";
import type { ReactiveTurnState } from "../state/turn.js";
import type { BBRTTool } from "../tools/tool-types.js";
import {
  exponentialBackoff,
  type ExponentialBackoffParameters,
} from "../util/exponential-backoff.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { streamJsonArrayItems } from "../util/stream-json-array-items.js";
import { adjustSchemaForGemini } from "./adjust-schema-for-gemini.js";
import type { BBRTDriver, BBRTDriverSendOptions } from "./driver-interface.js";
import type {
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiParameterSchema,
  GeminiPart,
  GeminiRequest,
  GeminiResponse,
} from "./gemini-types.js";

const BACKOFF_PARAMS: ExponentialBackoffParameters = {
  budget: 30_000,
  minDelay: 500,
  maxDelay: 5000,
  multiplier: 2,
  jitter: 0.1,
};

export class GeminiDriver implements BBRTDriver {
  readonly id = "gemini2";
  readonly name = "Gemini";
  readonly icon = "/bbrt/images/gemini-logomark.svg";

  readonly #getApiKey: () => Promise<Result<string | undefined>>;

  constructor(getApiKey: () => Promise<Result<string | undefined>>) {
    this.#getApiKey = getApiKey;
  }

  async *send({
    turns,
    systemPrompt,
    tools,
  }: BBRTDriverSendOptions): AsyncIterable<TurnChunk> {
    const contents = convertTurnsForGemini(turns);
    if (!contents.ok) {
      // TODO(aomarks) Send should return a Result.
      throw new Error(String(contents.error));
    }
    const request: GeminiRequest = {
      contents: contents.value,
    };
    if (systemPrompt.length > 0) {
      request.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    if (tools !== undefined && tools.size > 0) {
      request.tools = await convertToolsForGemini([...tools.values()]);
      request.toolConfig = { functionCallingConfig: { mode: "auto" } };
    } else {
      request.toolConfig = { functionCallingConfig: { mode: "none" } };
    }

    const model = "gemini-1.5-pro";
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`
    );
    const apiKey = await this.#getApiKey();
    if (!apiKey.ok) {
      return apiKey;
    }
    if (!apiKey.value) {
      return { ok: false, error: Error("No Gemini API key was available") };
    }
    url.searchParams.set("key", apiKey.value);

    const response = await (async (): Promise<Result<Response>> => {
      const fetchRequest = { method: "POST", body: JSON.stringify(request) };
      const retryDelays = exponentialBackoff(BACKOFF_PARAMS);
      const startTime = performance.now();
      for (let attempt = 0; ; attempt++) {
        const result = await resultify(fetch(url.href, fetchRequest));
        if (!result.ok) {
          return result;
        }
        const response = result.value;
        if (response.status === 200) {
          return result;
        }
        const retryable = response.status === /* Too Many Requests */ 429;
        if (retryable) {
          const delay = retryDelays.next();
          if (!delay.done) {
            await new Promise((resolve) => setTimeout(resolve, delay.value));
            continue;
          }
        }
        const seconds = Math.ceil((performance.now() - startTime) / 1000);
        const text = await resultify(result.value.text());
        return {
          ok: false,
          error: new Error(
            `Gemini API responded with HTTP status ${response.status}` +
              (attempt > 0
                ? ` after ${attempt + 1} attempts within ${seconds} seconds.`
                : ".") +
              (text.ok ? `\n\n${text.value}` : "")
          ),
        };
      }
    })();
    if (!response.ok) {
      throw new Error(String(response.error));
    }

    const body = response.value.body;
    if (body === null) {
      return {
        ok: false,
        error: Error("Gemini API response had null body"),
      };
    }
    yield* convertGeminiChunks(
      streamJsonArrayItems<GeminiResponse>(
        body.pipeThrough(new TextDecoderStream())
      )
    );
  }
}

async function* convertGeminiChunks(
  stream: AsyncIterable<GeminiResponse>
): AsyncIterableIterator<TurnChunk> {
  for await (const chunk of stream) {
    // TODO(aomarks) A way to send errors down the stream, or a side-channel.
    const candidate = chunk?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (candidate?.finishReason && candidate.finishReason !== "STOP") {
      console.error(
        `gemini chunk had finish reason ${candidate.finishReason}:` +
          ` ${JSON.stringify(chunk)}`
      );
    }
    if (parts === undefined) {
      console.error(`gemini chunk had no parts: ${JSON.stringify(chunk)}`);
      continue;
    }
    for (const part of parts) {
      if ("text" in part) {
        yield {
          timestamp: Date.now(),
          kind: "text",
          text: part.text,
        };
      } else if ("functionCall" in part) {
        yield {
          kind: "function-call",
          // Gemini function calls don't have IDs, but OpenAI appears to require
          // them in the case where you have more than tool call in a turn. So
          // lets make one up that's similar to the OpenAI format so that we can
          // send Gemini responses to OpenAI.
          timestamp: Date.now(),
          call: {
            callId: randomOpenAIFunctionCallStyleId(),
            functionId: part.functionCall.name,
            args: part.functionCall.args as JsonSerializableObject,
            response: { status: "unstarted" },
          },
        };
      } else {
        console.error(
          `gemini part had no text or functionCall: ${JSON.stringify(chunk)}`
        );
      }
    }
  }
}

export function convertTurnsForGemini(
  turns: ReactiveTurnState[]
): Result<GeminiContent[]> {
  const contents: GeminiContent[] = [];
  for (const turn of turns) {
    if (turn.status !== "done") {
      return {
        ok: false,
        error: Error(`Expected turn to be done, got ${turn.status}`),
      };
    }
    if (turn.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: turn.partialText }],
      });
    } else {
      turn.role satisfies "model";
      const functionCalls = turn.partialFunctionCalls;
      if (functionCalls.length === 0) {
        contents.push({
          role: "model",
          parts: [{ text: turn.partialText }],
        });
      } else {
        const modelParts: GeminiPart[] = [];
        if (turn.partialText) {
          modelParts.push({ text: turn.partialText });
        }
        const userParts: GeminiPart[] = [];
        for (const call of functionCalls) {
          const status = call.response.status;
          if (status === "unstarted" || status === "executing") {
            return {
              ok: false,
              error: new Error(`Function call was ${status}.`),
            };
          }
          status satisfies "success" | "error";
          modelParts.push({
            functionCall: {
              name: call.functionId,
              args: call.args,
            },
          });
          userParts.push({
            functionResponse: {
              name: call.functionId,
              response:
                status === "success"
                  ? call.response.result
                  : { error: call.response.error.message },
            },
          });
        }
        contents.push(
          {
            role: "model",
            parts: modelParts,
          },
          {
            role: "user",
            parts: userParts,
          }
        );
      }
    }
  }
  return { ok: true, value: contents };
}

export async function convertToolsForGemini(
  tools: BBRTTool[]
): Promise<GeminiRequest["tools"]> {
  // TODO(aomarks) 1 tool with N functions works, but N tools with 1
  // function each produces a 400 error. By design?
  return [
    {
      functionDeclarations: await Promise.all(
        tools.map(async (tool) => {
          // TODO(aomarks) Handle error.
          const inputSchema = (await tool.api()).value?.inputSchema;
          const fn: GeminiFunctionDeclaration = {
            name: tool.metadata.id,
            description: tool.metadata.description,
            parameters: inputSchema as GeminiParameterSchema,
          };
          if (inputSchema !== undefined) {
            fn.parameters = adjustSchemaForGemini(inputSchema);
          }
          return fn;
        })
      ),
    },
  ];
}

const RANDOM_STRING_LENGTH = 24;
const RANDOM_STRING_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomOpenAIFunctionCallStyleId() {
  return (
    "call_" +
    Array.from(crypto.getRandomValues(new Uint8Array(RANDOM_STRING_LENGTH)))
      .map((x) => RANDOM_STRING_CHARS[x % RANDOM_STRING_CHARS.length])
      .join("")
  );
}
