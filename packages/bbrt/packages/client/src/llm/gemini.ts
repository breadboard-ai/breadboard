/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GEMINI_API_KEY} from '../secrets.js';
import type {Result} from '../util/result.js';
import {streamJsonArrayItems} from '../util/stream-json-array-items.js';

export interface GeminiRequest {
  contents: Content[];
}

export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export interface Part {
  text: string;
}

export async function gemini(
  contents: Content[],
): Promise<Result<AsyncIterableIterator<string>, Error>> {
  const model = 'gemini-1.5-flash-latest';
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`,
  );
  url.searchParams.set('key', GEMINI_API_KEY);
  const request: GeminiRequest = {contents};
  const result = await fetch(url.href, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  if (result.status !== 200) {
    return {ok: false, error: Error(`http status was ${result.status}`)};
  }
  const body = result.body;
  if (body === null) {
    return {ok: false, error: Error('body was null')};
  }
  const stream = extractText(
    streamJsonArrayItems<GeminiResponse>(
      body.pipeThrough(new TextDecoderStream()),
    ),
  );
  return {ok: true, value: stream};
}

interface GeminiResponse {
  candidates: Array<{content: {parts: Array<{text: string}>}}>;
}

async function* extractText(
  stream: AsyncIterable<GeminiResponse>,
): AsyncIterableIterator<string> {
  for await (const chunk of stream) {
    yield chunk.candidates[0]?.content.parts[0]?.text ?? '';
  }
}
