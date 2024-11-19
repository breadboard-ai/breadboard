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
import {gemini, type GeminiContent} from './gemini.js';
import {openai, type Message} from './openai.js';

export type BBRTTurn = BBRTUserTurn | BBRTModelTurn | BBRTErrorTurn;

export type BBRTUserTurn = BBRTUserTurnContent | BBRTUserTurnToolResponse;

export interface BBRTUserTurnContent {
  kind: 'user-content';
  role: 'user';
  content: string;
}

export interface BBRTUserTurnToolResponse {
  kind: 'user-tool-response';
  role: 'user';
  tool: Tool;
  response: unknown;
}

export interface BBRTModelTurn {
  kind: 'model';
  role: 'model';
  content: string | AsyncIterable<string>;
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
  #model = 'openai';

  async send(userContent: string) {
    await this.#lock.do(async () => {
      this.turns.push({
        kind: 'user-content',
        role: 'user',
        content: userContent,
      });
      // TODO(aomarks) Support for loading indicators (another field on Turn).
      this.turns.push({kind: 'model', role: 'model', content: '...'});
      const toolCalls = new SignalArray<BBRTToolCall>();
      // TODO(aomarks) #generate() should return two streams/signals, instead of
      // taking toolCalls in.
      const result = await this.#generate(toolCalls);
      // Remove the temporary loading placeholder.
      this.turns.pop();
      if (result.ok) {
        const modelContent = new BufferedMultiplexStream(result.value.text);
        this.turns.push({
          kind: 'model',
          role: 'model',
          content: modelContent,
          toolCalls,
        });
      } else {
        this.turns.push({
          kind: 'error',
          role: 'model',
          error: result.error,
        });
      }
    });
  }

  async sendToolResponse(tool: Tool, response: unknown) {
    await this.#lock.do(async () => {
      this.turns.push({
        kind: 'user-tool-response',
        role: 'user',
        tool,
        response,
      });
      // TODO(aomarks) Support for loading indicators (another field on Turn).
      this.turns.push({kind: 'model', role: 'model', content: '...'});
      const toolCalls = new SignalArray<BBRTToolCall>();
      // TODO(aomarks) #generate() should return two streams/signals, instead of
      // taking toolCalls in.
      const result = await this.#generate(toolCalls);
      // Remove the temporary loading placeholder.
      this.turns.pop();
      if (result.ok) {
        const modelContent = new BufferedMultiplexStream(result.value.text);
        this.turns.push({
          kind: 'model',
          role: 'model',
          content: modelContent,
          toolCalls,
        });
      } else {
        this.turns.push({
          kind: 'error',
          role: 'model',
          error: result.error,
        });
      }
    });
  }

  async #generate(
    toolCalls: SignalArray<BBRTToolCall>,
  ): Promise<Result<{text: AsyncIterableIterator<string>}, Error>> {
    const onToolInvoke = (
      tool: Tool,
      args: Record<string, unknown>,
      result: unknown,
    ): void => {
      void this.sendToolResponse(tool, result);
      toolCalls.push({tool, args});
    };

    let text;
    if (this.#model === 'gemini') {
      text = await this.#generateGemini(onToolInvoke);
    } else {
      if (this.#model === 'openai') {
        text = await this.#generateOpenai(onToolInvoke);
      } else {
        throw new Error('Unknown model: ' + this.#model);
      }
    }

    if (!text.ok) {
      return text;
    }

    return {ok: true, value: {text: text.value}};
  }

  async #generateGemini(
    onToolInvoke: (
      tool: Tool,
      args: Record<string, unknown>,
      result: unknown,
    ) => void,
  ): Promise<Result<AsyncIterableIterator<string>, Error>> {
    return await gemini(
      {
        contents: await this.#contents(),
        tools: [{functionDeclarations: [getWikipediaArticle.declaration]}],
      },
      [getWikipediaArticle],
      onToolInvoke,
    );
  }

  async #generateOpenai(
    onToolInvoke: (
      tool: Tool,
      args: Record<string, unknown>,
      result: unknown,
    ) => void,
  ): Promise<Result<AsyncIterableIterator<string>, Error>> {
    return await openai(
      {
        model: 'gpt-3.5-turbo',
        messages: convertToOpenai((await this.#contents()).slice(0, -1)),
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
      },
      [getWikipediaArticle],
      onToolInvoke,
    );
  }

  async #contents(): Promise<GeminiContent[]> {
    const contents: GeminiContent[] = [];
    for (const turn of this.turns) {
      switch (turn.kind) {
        case 'user-content': {
          contents.push({role: 'user', parts: [{text: turn.content}]});
          break;
        }
        case 'user-tool-response': {
          // TODO(aomarks) Use the actual tool response format.
          contents.push({
            role: 'user',
            parts: [{text: `TURN RESPONSE: ${JSON.stringify(turn.response)}`}],
          });
          break;
        }
        case 'model': {
          if (typeof turn.content === 'string') {
            contents.push({role: 'model', parts: [{text: turn.content}]});
          } else {
            const text = (await Array.fromAsync(turn.content)).join('');
            contents.push({role: 'model', parts: [{text}]});
          }
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
}

function convertToOpenai(contents: GeminiContent[]): Message[] {
  const messages: Message[] = [];
  for (const content of contents) {
    messages.push({
      role: content.role === 'user' ? 'user' : 'system',
      content: content.parts
        .filter((part) => 'text' in part)
        .map((part) => part.text)
        .join(''),
    });
  }
  return messages;
}
