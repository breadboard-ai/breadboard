/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {JSONSchema7} from 'json-schema';
import {OPENAI_API_KEY} from '../secrets.js';
import type {Tool} from '../tools/tool.js';
import {JsonDataStreamTransformer} from '../util/json-data-stream-transformer.js';
import type {Result} from '../util/result.js';

export interface OpenAIChatRequest {
  stream?: boolean;
  model: string;
  messages: Message[];
  tools?: Array<OpenAITool>;
  tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | {type: 'function'; function: {name: string}};
}

export type Message = SystemMessage | UserMessage | ToolMessage;

export interface SystemMessage {
  role: 'system';
  name?: string;
  content: string | string[];
}

export interface UserMessage {
  role: 'user';
  name?: string;
  content: string | string[];
}

export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string | string[];
}

export type OpenAITool = {
  type: 'function';
  function: Function;
};

export interface Function {
  description?: string;
  name: string;
  parameters?: JSONSchema7 & {type: 'object'};
  strict?: boolean | null;
}

export async function openai(
  request: OpenAIChatRequest,
  tools: Tool[],
  onToolInvoke: (
    tool: Tool,
    args: Record<string, unknown>,
    result: unknown,
  ) => void,
): Promise<Result<AsyncIterableIterator<string>, Error>> {
  const url = new URL(`https://api.openai.com/v1/chat/completions`);
  let result;
  try {
    result = await fetch(url.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({...request, stream: true}),
    });
  } catch (e) {
    return {ok: false, error: e as Error};
  }
  if (result.status !== 200) {
    try {
      const error = (await result.json()) as unknown;
      return {
        ok: false,
        error: new Error(
          `HTTP status ${result.status}` +
            `\n\n${JSON.stringify(error, null, 2)}`,
        ),
      };
    } catch {
      return {ok: false, error: Error(`http status was ${result.status}`)};
    }
  }
  const body = result.body;
  if (body === null) {
    return {ok: false, error: Error('body was null')};
  }
  const stream = process(
    body.pipeThrough(new JsonDataStreamTransformer<OpenAiChunk>()),
    tools,
    onToolInvoke,
  );
  return {ok: true, value: stream};
}

async function* process(
  stream: AsyncIterable<OpenAiChunk>,
  tools: Tool[],
  onToolInvoke: (
    tool: Tool,
    args: Record<string, unknown>,
    result: unknown,
  ) => void,
): AsyncIterableIterator<string> {
  let hadToolCall = false;
  const toolCallBuffer = {name: '', arguments: ''};

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
      yield content;
      continue;
    }

    const toolCallChunk = delta.tool_calls?.[0];
    if (toolCallChunk) {
      hadToolCall = true;
      toolCallBuffer.name += toolCallChunk.function.name ?? '';
      toolCallBuffer.arguments += toolCallChunk.function.arguments ?? '';
      continue;
    }

    console.error(
      `could not interpret chunk: ${JSON.stringify(chunk, null, 2)}`,
    );
  }

  if (hadToolCall) {
    for (const tool of tools) {
      if (tool.declaration.name === toolCallBuffer.name) {
        const args = JSON.parse(toolCallBuffer.arguments) as Record<
          string,
          unknown
        >;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await tool.invoke(args);
        onToolInvoke(tool, args, result);
        break;
      }
    }
  }
}

interface OpenAiChunk {
  choices: Choice[];
}

interface Choice {
  delta: Delta;
  finish_reason: string | null;
}

interface Delta {
  content?: string;
  tool_calls: ToolCall[];
}

interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
}
