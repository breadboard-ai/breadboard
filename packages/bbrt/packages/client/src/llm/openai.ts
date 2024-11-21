/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {JSONSchema7} from 'json-schema';
import {OPENAI_API_KEY} from '../secrets.js';
import {JsonDataStreamTransformer} from '../util/json-data-stream-transformer.js';
import type {Result} from '../util/result.js';
import type {BBRTChunk} from './chunk.js';
import type {BBRTTurn} from './conversation.js';

export async function openai(
  request: OpenAIChatRequest,
): Promise<Result<AsyncIterableIterator<BBRTChunk>, Error>> {
  const url = new URL(`https://api.openai.com/v1/chat/completions`);
  let result;
  console.log('OPENAI REQUEST', JSON.stringify(request, null, 2));
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
  const stream = interpretOpenAIChunks(
    body.pipeThrough(new JsonDataStreamTransformer<OpenAIChunk>()),
  );
  return {ok: true, value: stream};
}

async function* interpretOpenAIChunks(
  stream: AsyncIterable<OpenAIChunk>,
): AsyncIterableIterator<BBRTChunk> {
  const toolCalls = new Map<
    number,
    {id: string; name: string; jsonArgs: string}
  >();

  for await (const chunk of stream) {
    console.log('OPENAI RESPONSE CHUNK', JSON.stringify(chunk, null, 2));
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
      yield {kind: 'append-content', content};
      continue;
    }

    if (delta.tool_calls != null) {
      for (const toolCallChunk of delta.tool_calls) {
        let buffer = toolCalls.get(toolCallChunk.index);
        if (buffer === undefined) {
          buffer = {id: '', name: '', jsonArgs: ''};
          toolCalls.set(toolCallChunk.index, buffer);
        }
        buffer.id += toolCallChunk.id ?? '';
        buffer.name += toolCallChunk.function.name ?? '';
        buffer.jsonArgs += toolCallChunk.function.arguments ?? '';
      }
      continue;
    }

    console.error(
      `could not interpret chunk: ${JSON.stringify(chunk, null, 2)}`,
    );
  }

  for (const call of toolCalls.values()) {
    yield {
      kind: 'tool-call',
      name: call.name,
      id: call.id,
      arguments: JSON.parse(call.jsonArgs) as Record<string, unknown>,
    };
  }
}

export interface OpenAIChatRequest {
  stream?: boolean;
  model: string;
  messages: OpenAIMessage[];
  tools?: Array<OpenAITool>;
  tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | {type: 'function'; function: {name: string}};
}

export type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

export interface OpenAISystemMessage {
  role: 'system';
  name?: string;
  content: string | string[];
}

export interface OpenAIUserMessage {
  role: 'user';
  name?: string;
  content: string | string[];
}

export interface OpenAIAssistantMessage {
  role: 'assistant';
  // TODO(aomarks) Actually at least one of content/tool_calls is required.
  content?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIToolMessage {
  role: 'tool';
  content: string | string[];
  tool_call_id: string;
}

export type OpenAITool = {
  type: 'function';
  function: OpenAIFunction;
};

export interface OpenAIFunction {
  description?: string;
  name: string;
  parameters?: JSONSchema7;
  strict?: boolean | null;
}

interface OpenAIChunk {
  choices: OpenAIChoice[];
}

interface OpenAIChoice {
  delta: OpenAIDelta;
  finish_reason: string | null;
}

interface OpenAIDelta {
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  // TODO(aomarks) You get index coming in, but it probably shouldn't be there
  // going out?
  index: number;
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export async function bbrtTurnsToOpenAiMessages(
  turns: BBRTTurn[],
): Promise<OpenAIMessage[]> {
  const messages: OpenAIMessage[] = [];
  for (const turn of turns) {
    switch (turn.kind) {
      case 'user-content': {
        messages.push({role: 'user', content: turn.content});
        break;
      }
      case 'user-tool-responses': {
        for (const response of turn.responses) {
          messages.push({
            role: 'tool',
            tool_call_id: response.id,
            content: JSON.stringify(response.response),
          });
        }
        break;
      }
      case 'model': {
        const content = (await Array.fromAsync(turn.content)).join('');
        const msg: OpenAIAssistantMessage = {role: 'assistant'};
        if (content) {
          msg.content = content;
        }
        if (turn.toolCalls?.length) {
          msg.tool_calls = await Promise.all(
            turn.toolCalls.map(async (toolCall) => ({
              // TODO(aomarks) We shouldn't need to specify an index, typings isue
              // (need request vs response variants).
              index: undefined as unknown as number,
              id: toolCall.id,
              type: 'function',
              function: {
                name: (await toolCall.tool.declaration()).name,
                arguments: JSON.stringify(toolCall.args),
              },
            })),
          );
        }
        messages.push(msg);
        break;
      }
      case 'error': {
        // TODO(aomarks) Do something better?
        break;
      }
      default: {
        turn satisfies never;
        console.error('Unknown turn kind:', turn);
        break;
      }
    }
  }
  return messages;
}
