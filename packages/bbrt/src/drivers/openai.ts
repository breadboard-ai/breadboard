/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TurnChunk } from "../state/turn-chunk.js";
import type { ReactiveTurnState } from "../state/turn.js";
import type { BBRTTool } from "../tools/tool-types.js";
import { makeErrorEvent } from "../util/event-factories.js";
import {
  exponentialBackoff,
  type ExponentialBackoffParameters,
} from "../util/exponential-backoff.js";
import { JsonDataStreamTransformer } from "../util/json-data-stream-transformer.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import type { BBRTDriver, BBRTDriverSendOptions } from "./driver-interface.js";
import type {
  OpenAIChatRequest,
  OpenAIChunk,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolCall,
  OpenAIToolMessage,
} from "./openai-types.js";

const BACKOFF_PARAMS: ExponentialBackoffParameters = {
  budget: 30_000,
  minDelay: 500,
  maxDelay: 5000,
  multiplier: 2,
  jitter: 0.1,
};

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
  }: BBRTDriverSendOptions): AsyncGenerator<TurnChunk, void> {
    const messages = await convertTurnsForOpenAi(turns);
    if (!messages.ok) {
      yield makeErrorEvent(messages.error);
      return;
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
        yield makeErrorEvent(openAiTools.error);
        return;
      }
      request.tools = openAiTools.value;
    }
    const url = new URL(`https://api.openai.com/v1/chat/completions`);
    const apiKey = await this.#getApiKey();
    if (!apiKey.ok) {
      yield makeErrorEvent(apiKey.error);
      return;
    }
    if (!apiKey.value) {
      yield makeErrorEvent(
        new Error(
          "No OpenAI API key was available. " +
            "Add an OPENAI_API_KEY secret in Visual Editor settings."
        )
      );
      return;
    }

    const response = await (async (): Promise<Result<Response>> => {
      const fetchRequest = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.value}`,
        },
        body: JSON.stringify(request),
      };
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
            `OpenAI API responded with HTTP status ${response.status}` +
              (attempt > 0
                ? ` after ${attempt + 1} attempts within ${seconds} seconds.`
                : ".") +
              (text.ok ? `\n\n${text.value}` : "")
          ),
        };
      }
    })();
    if (!response.ok) {
      yield makeErrorEvent(response.error);
      return;
    }

    const body = response.value.body;
    if (body === null) {
      yield makeErrorEvent(new Error("OpenAI API response had null body"));
      return;
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
