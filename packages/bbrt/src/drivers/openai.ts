/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TurnChunk } from "../state/turn-chunk.js";
import type { ReactiveTurnState } from "../state/turn.js";
import type { BBRTTool } from "../tools/tool-types.js";
import { JsonDataStreamTransformer } from "../util/json-data-stream-transformer.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import type { Result } from "../util/result.js";
import type { BBRTDriver, BBRTDriverSendOptions } from "./driver-interface.js";
import type {
  OpenAIChatRequest,
  OpenAIChunk,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolCall,
  OpenAIToolMessage,
} from "./openai-types.js";

export class OpenAiDriver implements BBRTDriver {
  readonly id = "openai";
  readonly name = "OpenAI";
  readonly icon = "/bbrt/images/openai-logomark.svg";

  readonly #getApiKey: () => Promise<Result<string | undefined>>;

  constructor(getApiKey: () => Promise<Result<string | undefined>>) {
    this.#getApiKey = getApiKey;
  }

  async *send({
    turns,
    systemPrompt,
    tools,
  }: BBRTDriverSendOptions): AsyncIterable<TurnChunk> {
    const messages = await convertTurnsForOpenAi(turns);
    if (!messages.ok) {
      // TODO(aomarks) Send should return a Result.
      throw new Error(String(messages.error));
    }
    const request: OpenAIChatRequest = {
      model: "gpt-4o",
      stream: true,
      messages: messages.value,
    };
    if (systemPrompt.length > 0) {
      messages.value.push({ role: "system", content: systemPrompt });
    }
    if (tools !== undefined && tools.size > 0) {
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
    yield* convertOpenAiChunks(
      body.pipeThrough(new JsonDataStreamTransformer<OpenAIChunk>())
    );
  }
}

async function* convertOpenAiChunks(
  stream: AsyncIterable<OpenAIChunk>
): AsyncIterableIterator<TurnChunk> {
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
      yield {
        timestamp: Date.now(),
        kind: "text",
        text: content,
      };
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
      kind: "function-call",
      timestamp: Date.now(),
      call: {
        functionId: call.name,
        callId: call.id,
        args: JSON.parse(call.jsonArgs) as JsonSerializableObject,
        response: {
          status: "unstarted",
        },
      },
    };
  }
}

export function convertTurnsForOpenAi(
  turns: ReactiveTurnState[]
): Result<OpenAIMessage[]> {
  const messages: OpenAIMessage[] = [];
  for (const turn of turns) {
    if (turn.status !== "done") {
      return { ok: false, error: Error("Turn was not done") };
    }
    if (turn.role === "user") {
      messages.push({
        role: "user",
        content: turn.partialText,
      });
    } else {
      turn.role satisfies "model";
      const functionCalls = turn.partialFunctionCalls;
      if (functionCalls.length === 0) {
        messages.push({
          role: "assistant",
          content: turn.partialText,
        });
      } else {
        const toolCalls: OpenAIToolCall[] = [];
        const toolResponses: OpenAIToolMessage[] = [];
        for (const call of functionCalls) {
          const status = call.response.status;
          if (status === "unstarted" || status === "executing") {
            return {
              ok: false,
              error: new Error(`Function call was ${status}.`),
            };
          }
          status satisfies "success" | "error";
          toolCalls.push({
            // TODO(aomarks) Kinda silly, see note in OpenAIToolCall interface.
            index: undefined as unknown as number,
            id: call.callId,
            type: "function",
            function: {
              name: call.functionId,
              arguments: JSON.stringify(call.args),
            },
          });
          toolResponses.push({
            role: "tool",
            tool_call_id: call.callId,
            content: JSON.stringify(
              status === "success"
                ? call.response.result
                : { error: call.response.error.message }
            ),
          });
        }
        messages.push(
          {
            role: "assistant",
            content: turn.partialText,
            tool_calls: toolCalls,
          },
          ...toolResponses
        );
      }
    }
  }
  return { ok: true, value: messages };
}

export async function convertToolsForOpenAi(
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
