/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BBRTChunk } from "../llm/chunk.js";
import type { BBRTTurn } from "../llm/conversation-types.js";
import type { BBRTTool } from "../tools/tool.js";
import {
  exponentialBackoff,
  type ExponentialBackoffParameters,
} from "../util/exponential-backoff.js";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { streamJsonArrayItems } from "../util/stream-json-array-items.js";
import { adjustSchemaForGemini } from "./adjust-schema-for-gemini.js";
import type { BBRTDriver } from "./driver-interface.js";
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
  readonly name = "Gemini";
  readonly icon = "/bbrt/images/gemini-logomark.svg";

  readonly #getApiKey: () => Promise<Result<string | undefined>>;

  constructor(getApiKey: () => Promise<Result<string | undefined>>) {
    this.#getApiKey = getApiKey;
  }

  async executeTurn(
    turns: BBRTTurn[],
    tools: BBRTTool[]
  ): Promise<Result<AsyncIterableIterator<BBRTChunk>>> {
    const contents = await convertTurnsForGemini(turns);
    const request: GeminiRequest = {
      contents,
    };
    if (tools.length > 0) {
      request.tools = await convertToolsForGemini(tools);
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
      return response;
    }

    const body = response.value.body;
    if (body === null) {
      return {
        ok: false,
        error: Error("Gemini API response had null body"),
      };
    }
    const stream = convertGeminiChunks(
      streamJsonArrayItems<GeminiResponse>(
        body.pipeThrough(new TextDecoderStream())
      )
    );
    return { ok: true, value: stream };
  }
}

async function* convertGeminiChunks(
  stream: AsyncIterable<GeminiResponse>
): AsyncIterableIterator<BBRTChunk> {
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
        yield { kind: "append-content", content: part.text };
      } else if ("functionCall" in part) {
        yield {
          kind: "tool-call",
          // Gemini function calls don't have IDs, but OpenAI appears to require
          // them in the case where you have more than tool call in a turn. So
          // lets make one up that's similar to the OpenAI format so that we can
          // send Gemini responses to OpenAI.
          id: randomOpenAIFunctionCallStyleId(),
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        };
      } else {
        console.error(
          `gemini part had no text or functionCall: ${JSON.stringify(chunk)}`
        );
      }
    }
  }
}

async function convertTurnsForGemini(
  turns: BBRTTurn[]
): Promise<GeminiContent[]> {
  const contents: GeminiContent[] = [];
  for (const turn of turns) {
    if (turn.status.get() !== "done") {
      continue;
    }
    switch (turn.kind) {
      case "user-content": {
        contents.push({ role: "user", parts: [{ text: turn.content }] });
        break;
      }
      case "user-tool-responses": {
        contents.push({
          role: "user",
          parts: turn.responses.map((response) => ({
            functionResponse: {
              name: response.tool.metadata.id,
              response: response.response.output,
              // TOOD(aomarks) It really feels like we should also provide the
              // arguments or an id, since we might have more than one call to
              // the same tool. Maybe it uses the ordering (which we preserve),
              // or maybe the LLM just figures it out from context most of the
              // time anyway.
            },
          })),
        });
        break;
      }
      case "model": {
        const text = (await Array.fromAsync(turn.content)).join("");
        const content: GeminiContent = { role: "model", parts: [] };
        if (text) {
          content.parts.push({ text });
        }
        if (turn.toolCalls?.length) {
          content.parts.push(
            ...turn.toolCalls.map(
              (toolCall): GeminiPart => ({
                functionCall: {
                  name: toolCall.tool.metadata.id,
                  args: toolCall.args,
                },
              })
            )
          );
        }
        contents.push(content);
        break;
      }
      case "error": {
        // TODO(aomarks) Do something better?
        break;
      }
      default: {
        turn satisfies never;
        console.error("Unknown turn kind:", turn);
        break;
      }
    }
  }
  return contents;
}

async function convertToolsForGemini(
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
