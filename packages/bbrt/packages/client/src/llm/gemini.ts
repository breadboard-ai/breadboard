/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GEMINI_API_KEY} from '../secrets.js';
import type {FunctionDeclaration, Tool} from '../tools/tool.js';
import type {Result} from '../util/result.js';
import {streamJsonArrayItems} from '../util/stream-json-array-items.js';

export interface GeminiRequest {
  contents: GeminiContent[];
  tools?: Array<{
    functionDeclarations: FunctionDeclaration[];
  }>;
  toolConfig?: {
    mode: 'auto' | 'any' | 'none';
    allowedFunctionNames: string[];
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: Part[];
}

export type Part = TextPart | FunctionCallPart;

export interface TextPart {
  text: string;
}

export interface FunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GeminiResponse {
  candidates: Candidate[];
}

export interface Candidate {
  content: GeminiContent;
}

export async function gemini(
  request: GeminiRequest,
  tools: Tool[],
  onToolInvoke: (
    tool: Tool,
    args: Record<string, unknown>,
    result: unknown,
  ) => void,
): Promise<Result<AsyncIterableIterator<string>, Error>> {
  const model = 'gemini-1.5-flash-latest';
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
  );
  url.searchParams.set('key', GEMINI_API_KEY);
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
  const stream = extractText(
    streamJsonArrayItems<GeminiResponse>(
      body.pipeThrough(new TextDecoderStream()),
    ),
    tools,
    onToolInvoke,
  );
  return {ok: true, value: stream};
}

async function* extractText(
  stream: AsyncIterable<GeminiResponse>,
  tools: Tool[],
  onToolInvoke: (
    tool: Tool,
    args: Record<string, unknown>,
    result: unknown,
  ) => void,
): AsyncIterableIterator<string> {
  for await (const chunk of stream) {
    // TODO(aomarks) Sometimes we get no parts, just a mostly empty message.
    // That should probably generate an error, which should somehow appear on
    // this stream.
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (parts === undefined) {
      console.error(`chunk had no parts: ${JSON.stringify(chunk)}`);
      continue;
    }
    for (const part of parts) {
      if ('text' in part) {
        yield part.text;
      } else if ('functionCall' in part) {
        for (const tool of tools) {
          if (tool.declaration.name === part.functionCall.name) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = await tool.invoke(part.functionCall.args);
            onToolInvoke(tool, part.functionCall.args, result);
            break;
          }
        }
      }
    }
  }
}
