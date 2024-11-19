/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GEMINI_API_KEY} from '../secrets.js';
import type {Result} from '../util/result.js';
import {streamJsonArrayItems} from '../util/stream-json-array-items.js';
import type {BBRTChunk} from './chunk.js';
import type {BBRTTurn} from './conversation.js';

export async function gemini(
  request: GeminiRequest,
): Promise<Result<AsyncIterableIterator<BBRTChunk>, Error>> {
  const model = 'gemini-1.5-flash-latest';
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
  );
  url.searchParams.set('key', GEMINI_API_KEY);
  console.log('GEMINI REQUEST', JSON.stringify(request, null, 2));
  let result;
  try {
    result = await fetch(url.href, {
      method: 'POST',
      body: JSON.stringify(request),
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
  const stream = interpretGeminiChunks(
    streamJsonArrayItems<GeminiResponse>(
      body.pipeThrough(new TextDecoderStream()),
    ),
  );
  return {ok: true, value: stream};
}

async function* interpretGeminiChunks(
  stream: AsyncIterable<GeminiResponse>,
): AsyncIterableIterator<BBRTChunk> {
  for await (const chunk of stream) {
    console.log('GEMINI RESPONSE CHUNK', JSON.stringify(chunk, null, 2));
    // TODO(aomarks) Sometimes we get no parts, just a mostly empty message.
    // That should probably generate an error, which should somehow appear on
    // this stream.
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (parts === undefined) {
      console.error(`gemini chunk had no parts: ${JSON.stringify(chunk)}`);
      continue;
    }
    for (const part of parts) {
      if ('text' in part) {
        yield {kind: 'append-content', content: part.text};
      } else if ('functionCall' in part) {
        yield {
          kind: 'tool-call',
          // TODO(aomarks) Gemini tool calls don't have IDs, I guess? So, how
          // can there be more than one tool call of the same type?
          id: '',
          name: part.functionCall.name,
          arguments: part.functionCall.args,
        };
      } else {
        console.error(
          `gemini part had no text or functionCall: ${JSON.stringify(chunk)}`,
        );
      }
    }
  }
}

export interface GeminiRequest {
  contents: GeminiContent[];
  tools?: Array<{
    functionDeclarations: GeminiFunctionDeclaration[];
  }>;
  toolConfig?: {
    mode: 'auto' | 'any' | 'none';
    allowedFunctionNames: string[];
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCall
  | GeminiFunctionResponse;

export interface GeminiTextPart {
  text: string;
}

export interface GeminiFunctionCall {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GeminiFunctionResponse {
  functionResponse: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
}

export interface GeminiCandidate {
  content: GeminiContent;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiParameterSchema & {type: 'object'};
}

export type GeminiParameterSchema = {
  description?: string;
  nullable?: boolean;
} & (
  | {type: 'string'; format: 'enum'; enum: string[]}
  | {type: 'string'; format?: undefined}
  | {type: 'number'; format?: 'float' | 'double'}
  | {type: 'boolean'}
  | {
      type: 'array';
      minItems?: number;
      maxItems?: number;
      items?: GeminiParameterSchema;
    }
  | {
      type: 'object';
      required?: string[];
      properties?: Record<string, GeminiParameterSchema>;
    }
);

export async function bbrtTurnsToGeminiContents(
  turns: BBRTTurn[],
): Promise<GeminiContent[]> {
  const contents: GeminiContent[] = [];
  for (const turn of turns) {
    switch (turn.kind) {
      case 'user-content': {
        contents.push({role: 'user', parts: [{text: turn.content}]});
        break;
      }
      case 'user-tool-responses': {
        for (const response of turn.responses) {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: response.tool.declaration.name,
                  response: response.response,
                  // TOOD(aomarks) It really feels like we should also provide
                  // the arguments or an id, since we might have more than one
                  // call to the same tool. Maybe it uses the ordering (which we
                  // preserve), or maybe the LLM just figures it out from
                  // context most of the time anyway.
                },
              },
            ],
          });
        }
        break;
      }
      case 'model': {
        const text = (await Array.fromAsync(turn.content)).join('');
        const content: GeminiContent = {role: 'model', parts: []};
        if (text) {
          content.parts.push({text});
        }
        if (turn.toolCalls?.length) {
          content.parts.push(
            ...turn.toolCalls.map(
              (toolCall): GeminiPart => ({
                functionCall: {
                  name: toolCall.tool.declaration.name,
                  args: toolCall.args,
                },
              }),
            ),
          );
        }
        contents.push(content);
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
  return contents;
}
