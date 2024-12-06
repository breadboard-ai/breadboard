/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BBRTChunk } from "../llm/chunk.js";
import type { BBRTTurn } from "../llm/conversation-types.js";
import type { BBRTTool } from "../tools/tool.js";
import { JsonDataStreamTransformer } from "../util/json-data-stream-transformer.js";
import type { Result } from "../util/result.js";
import type { BBRTDriver } from "./driver-interface.js";
import type {
  OpenAIAssistantMessage,
  OpenAIChatRequest,
  OpenAIChunk,
  OpenAIMessage,
  OpenAITool,
} from "./openai-types.js";

export class OpenAiDriver implements BBRTDriver {
  readonly name = "OpenAI";
  readonly icon = "/bbrt/images/openai-logomark.svg";

  readonly #getApiKey: () => Promise<Result<string | undefined>>;

  constructor(getApiKey: () => Promise<Result<string | undefined>>) {
    this.#getApiKey = getApiKey;
  }

  async executeTurn(
    turns: BBRTTurn[],
    tools: BBRTTool[]
  ): Promise<Result<AsyncIterableIterator<BBRTChunk>>> {
    const messages = await convertTurnsForOpenAi(turns);
    const request: OpenAIChatRequest = {
      model: "gpt-4o",
      stream: true,
      messages,
    };
    if (tools.length > 0) {
      const openAiTools = await convertToolsForOpenAi([...tools.values()]);
      if (!openAiTools.ok) {
        return openAiTools;
      }
      request.tools = openAiTools.value;
    }

    const url = new URL(`https://api.openai.com/v1/chat/completions`);
    const apiKey = await this.#getApiKey();
    if (!apiKey.ok) {
      return apiKey;
    }
    if (!apiKey.value) {
      return { ok: false, error: Error("No OpenAI API key was available") };
    }
    let result;
    try {
      result = await fetch(url.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.value}`,
        },
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
    const stream = convertOpenAiChunks(
      body.pipeThrough(new JsonDataStreamTransformer<OpenAIChunk>())
    );
    return { ok: true, value: stream };
  }
}

async function* convertOpenAiChunks(
  stream: AsyncIterable<OpenAIChunk>
): AsyncIterableIterator<BBRTChunk> {
  const toolCalls = new Map<
    number,
    { id: string; name: string; jsonArgs: string }
  >();

  for await (const chunk of stream) {
    const choice = chunk?.choices?.[0];
    if (!choice) {
      console.error(`chunk had no choice: ${JSON.stringify(chunk, null, 2)}`);
      continue;
    }

    if (choice.finish_reason) {
      continue;
    }

    const delta = choice.delta;
    if (!delta) {
      console.error(`chunk had no delta: ${JSON.stringify(chunk, null, 2)}`);
      continue;
    }

    const content = delta.content;
    if (content != null) {
      yield { kind: "append-content", content };
      continue;
    }

    if (delta.tool_calls != null) {
      for (const toolCallChunk of delta.tool_calls) {
        let buffer = toolCalls.get(toolCallChunk.index);
        if (buffer === undefined) {
          buffer = { id: "", name: "", jsonArgs: "" };
          toolCalls.set(toolCallChunk.index, buffer);
        }
        buffer.id += toolCallChunk.id ?? "";
        buffer.name += toolCallChunk.function.name ?? "";
        buffer.jsonArgs += toolCallChunk.function.arguments ?? "";
      }
      continue;
    }

    console.error(
      `could not interpret chunk: ${JSON.stringify(chunk, null, 2)}`
    );
  }

  for (const call of toolCalls.values()) {
    yield {
      kind: "tool-call",
      name: call.name,
      id: call.id,
      arguments: JSON.parse(call.jsonArgs) as Record<string, unknown>,
    };
  }
}

async function convertTurnsForOpenAi(
  turns: BBRTTurn[]
): Promise<OpenAIMessage[]> {
  const messages: OpenAIMessage[] = [];
  for (const turn of turns) {
    if (turn.status.get() !== "done") {
      continue;
    }
    switch (turn.kind) {
      case "user-content": {
        messages.push({ role: "user", content: turn.content });
        break;
      }
      case "user-tool-responses": {
        for (const response of turn.responses) {
          messages.push({
            role: "tool",
            tool_call_id: response.id,
            content: JSON.stringify(response.response.output),
          });
        }
        break;
      }
      case "model": {
        const content = (await Array.fromAsync(turn.content)).join("");
        const msg: OpenAIAssistantMessage = { role: "assistant" };
        if (content) {
          msg.content = content;
        }
        if (turn.toolCalls?.length) {
          msg.tool_calls = turn.toolCalls.map((toolCall) => ({
            // TODO(aomarks) We shouldn't need to specify an index, typings isue
            // (need request vs response variants).
            index: undefined as unknown as number,
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.tool.metadata.id,
              arguments: JSON.stringify(toolCall.args),
            },
          }));
        }
        messages.push(msg);
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
  return messages;
}

async function convertToolsForOpenAi(
  tools: BBRTTool[]
): Promise<Result<OpenAIChatRequest["tools"]>> {
  const results: OpenAITool[] = [];
  const errors: unknown[] = [];
  await Promise.all(
    tools.map(async (tool) => {
      const { id, description } = tool.metadata;
      const api = await tool.api();
      if (!api.ok) {
        errors.push(api.error);
        return;
      }
      const { inputSchema } = api.value;
      results.push({
        type: "function",
        function: {
          name: id,
          description,
          parameters: inputSchema,
        },
      });
    })
  );
  if (errors.length > 0) {
    return { ok: false, error: new AggregateError(errors) };
  }
  return { ok: true, value: results };
}
