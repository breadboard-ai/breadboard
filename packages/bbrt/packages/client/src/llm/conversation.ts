/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import type {Tool} from '../tools/tool.js';
import {getWikipediaArticle} from '../tools/wikipedia.js';
import {BufferedMultiplexStream} from '../util/buffered-multiplex-stream.js';
import {Lock} from '../util/lock.js';
import type {Result} from '../util/result.js';
import type {BBRTChunk} from './chunk.js';
import {bbrtTurnsToGeminiContents, gemini} from './gemini.js';
import {bbrtTurnsToOpenAiMessages, openai} from './openai.js';

export type BBRTTurn = BBRTUserTurn | BBRTModelTurn | BBRTErrorTurn;

export type BBRTUserTurn = BBRTUserTurnContent | BBRTUserTurnToolResponses;

export interface BBRTUserTurnContent {
  kind: 'user-content';
  role: 'user';
  content: string;
}

export interface BBRTUserTurnToolResponses {
  kind: 'user-tool-responses';
  role: 'user';
  responses: BBRTToolResponse[];
}

export interface BBRTToolResponse {
  id: string;
  tool: Tool;
  response: Record<string, unknown>;
}

export interface BBRTModelTurn {
  kind: 'model';
  role: 'model';
  content: AsyncIterable<string>;
  toolCalls?: SignalArray<BBRTToolCall>;
}

export interface BBRTErrorTurn {
  kind: 'error';
  role: 'user' | 'model';
  error: unknown;
}

export interface BBRTToolCall {
  tool: Tool;
  args: Record<string, unknown>;
}

export class BBRTConversation {
  readonly turns = new SignalArray<BBRTTurn>();
  readonly #lock = new Lock();
  readonly #tools = [getWikipediaArticle];
  #model = 'openai';

  async send(message: {content: string} | {toolResponses: BBRTToolResponse[]}) {
    await this.#lock.do(async () => {
      // Note we only support sending either content or tool responses in one
      // message, not both.
      if ('toolResponses' in message) {
        this.turns.push({
          kind: 'user-tool-responses',
          role: 'user',
          responses: message.toolResponses,
        });
      } else {
        this.turns.push({
          kind: 'user-content',
          role: 'user',
          content: message.content,
        });
      }
      // TODO(aomarks) Add a "loading" model turn since the initial response
      // could take a moment. But note we need to exclude it from the contents
      // we send. Maybe we should have a state field on model turn so that we
      // can exclude it when it's not done.

      const result = await this.#generate();
      if (!result.ok) {
        this.turns.push({
          kind: 'error',
          role: 'model',
          error: result.error,
        });
        return;
      }

      const toolCalls = new SignalArray<BBRTToolCall>();
      const contentStream = new TransformStream<string, string>();
      this.turns.push({
        kind: 'model',
        role: 'model',
        content: new BufferedMultiplexStream(contentStream.readable),
        toolCalls,
      });

      const contentWriter = contentStream.writable.getWriter();
      const toolResponsePromises: Array<Promise<BBRTToolResponse>> = [];
      for await (const chunk of result.value) {
        console.log('BBRT RESPONSE CHUNK', JSON.stringify(chunk, null, 2));
        switch (chunk.kind) {
          case 'append-content': {
            await contentWriter.write(chunk.content);
            break;
          }
          case 'tool-call': {
            const tool = this.#tools.find(
              (tool) => tool.declaration.name === chunk.name,
            );
            if (tool === undefined) {
              console.error('unknown tool', JSON.stringify(chunk));
              break;
            }
            toolCalls.push({id: chunk.id, tool, args: chunk.arguments});
            toolResponsePromises.push(
              this.#invokeTool(tool, chunk.id, chunk.arguments),
            );
            break;
          }
          default: {
            chunk satisfies never;
            console.error('unknown chunk kind:', chunk);
            break;
          }
        }
      }
      await contentWriter.close();
      if (toolResponsePromises.length > 0) {
        const toolResponses = await Promise.all(toolResponsePromises);
        setTimeout(() => {
          // TODO(aomarks) Hacky. We need to return from this function before
          // sending the response, since otherwise we'll get deadlocked.
          void this.send({toolResponses});
        });
      }
    });
  }

  async #invokeTool(
    tool: Tool,
    id: string,
    args: Record<string, unknown>,
  ): Promise<BBRTToolResponse> {
    const response = await tool.invoke(args);
    return {id, tool, response};
  }

  async #generate(): Promise<Result<AsyncIterableIterator<BBRTChunk>, Error>> {
    let chunks;
    if (this.#model === 'gemini') {
      chunks = await this.#generateGemini();
    } else if (this.#model === 'openai') {
      chunks = await this.#generateOpenai();
    } else {
      throw new Error('Unknown model: ' + this.#model);
    }
    if (!chunks.ok) {
      return chunks;
    }
    return {ok: true, value: chunks.value};
  }

  async #generateGemini(): Promise<
    Result<AsyncIterableIterator<BBRTChunk>, Error>
  > {
    const contents = await bbrtTurnsToGeminiContents(this.turns);
    return gemini({
      contents,
      // TODO(aomarks) Generate tools from tools array.
      tools: [{functionDeclarations: [getWikipediaArticle.declaration]}],
    });
  }

  async #generateOpenai(): Promise<
    Result<AsyncIterableIterator<BBRTChunk>, Error>
  > {
    const messages = await bbrtTurnsToOpenAiMessages(this.turns);
    return openai({
      model: 'gpt-3.5-turbo',
      messages,
      // TODO(aomarks) Generate tools from tools array.
      tools: [
        {
          type: 'function',
          function: {
            description: getWikipediaArticle.declaration.description,
            name: getWikipediaArticle.declaration.name,
            parameters: getWikipediaArticle.declaration.parameters,
          },
        },
      ],
    });
  }
}
