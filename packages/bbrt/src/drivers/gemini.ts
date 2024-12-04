/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BBRTChunk } from "../llm/chunk.js";
import type { BBRTTurn } from "../llm/conversation.js";
import type { BBRTTool } from "../tools/tool.js";
import type { Result } from "../util/result.js";
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
    let result;
    try {
      result = await fetch(url.href, {
        method: "POST",
        body: JSON.stringify(request),
      });
    } catch (e) {
      return { ok: false, error: e as Error };
    }
    if (result.status !== 200) {
      try {
        const error = (await result.json()) as unknown;
        return {
          ok: false,
          error: new Error(
            `HTTP status ${result.status}` +
              `\n\n${JSON.stringify(error, null, 2)}`
          ),
        };
      } catch {
        return { ok: false, error: Error(`http status was ${result.status}`) };
      }
    }
    const body = result.body;
    if (body === null) {
      return { ok: false, error: Error("body was null") };
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
    // TODO(aomarks) Sometimes we get no parts, just a mostly empty message.
    // That should probably generate an error, which should somehow appear on
    // this stream.
    const parts = chunk?.candidates?.[0]?.content?.parts;
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
