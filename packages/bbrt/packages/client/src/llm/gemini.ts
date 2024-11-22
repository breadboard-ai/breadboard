/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {JSONSchema7} from 'json-schema';
import type {Result} from '../util/result.js';
import {streamJsonArrayItems} from '../util/stream-json-array-items.js';
import type {BBRTChunk} from './chunk.js';
import type {BBRTTurn} from './conversation.js';

export async function gemini(
  request: GeminiRequest,
  apiKey: string,
): Promise<Result<AsyncIterableIterator<BBRTChunk>, Error>> {
  const model = 'gemini-1.5-flash-latest';
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
  );
  url.searchParams.set('key', apiKey);
  // console.log('GEMINI REQUEST', JSON.stringify(request, null, 2));
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
    // console.log('GEMINI RESPONSE CHUNK', JSON.stringify(chunk, null, 2));
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
  parameters?: GeminiParameterSchema;
}

export type GeminiParameterSchema = {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  // TODO(aomarks) nullable is not standard JSON Schema, right? Usually
  // "required" is how you express that.
  nullable?: boolean;
  description?: string;
  properties?: Record<string, GeminiParameterSchema>;
  required?: string[];
  format?: string;
  enum?: string[];
  items?: GeminiParameterSchema;
  minItems?: number;
  maxItems?: number;
};

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
                  name: (await response.tool.declaration()).name,
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
            ...(await Promise.all(
              turn.toolCalls.map(
                async (toolCall): Promise<GeminiPart> => ({
                  functionCall: {
                    name: (await toolCall.tool.declaration()).name,
                    args: toolCall.args,
                  },
                }),
              ),
            )),
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

const RANDOM_STRING_LENGTH = 24;
const RANDOM_STRING_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomOpenAIFunctionCallStyleId() {
  return (
    'call_' +
    Array.from(crypto.getRandomValues(new Uint8Array(RANDOM_STRING_LENGTH)))
      .map((x) => RANDOM_STRING_CHARS[x % RANDOM_STRING_CHARS.length])
      .join('')
  );
}

export function simplifyJsonSchemaForGemini(
  rootInput: JSONSchema7,
): GeminiParameterSchema {
  const rootOutput: GeminiParameterSchema = {type: 'object'};
  function visit(input: JSONSchema7, output: GeminiParameterSchema) {
    if (input.type === 'object') {
      output.type = 'object';
      if (input.properties !== undefined) {
        output.properties = {};
        for (const [key, value] of Object.entries(input.properties)) {
          output.properties[key] = {};
          if (value === true) {
            // TODO(aomarks) True means "any" type, but Gemini doesn't support
            // that. How out just a string? Maybe object would be better? A true
            // here doesn't seem to be used much anyway.
            output.properties[key] = {type: 'string'};
          } else if (value === false) {
            continue;
          } else {
            visit(value, output.properties[key]);
          }
        }
      }
      if (input.required !== undefined && input.required.length > 0) {
        output.required = input.required;
      }
    } else if (input.type === 'string') {
      output.type = 'string';
      if (input.format !== undefined) {
        output.format = input.format;
      }
    }
    // TODO(aomarks) More cases to support here!
  }
  visit(rootInput, rootOutput);
  console.log(
    'SIMPLIFIED JSON SCHEMA FOR GEMINI',
    JSON.stringify(rootInput, null, 2),
    '\n',
    JSON.stringify(rootOutput, null, 2),
  );
  return rootOutput;
}
