/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import {getWikipediaArticle} from '../tools/wikipedia.js';
import {BufferedMultiplexStream} from '../util/buffered-multiplex-stream.js';
import {Lock} from '../util/lock.js';
import type {Result} from '../util/result.js';
import {gemini, type Content} from './gemini.js';
import {openai, type Message} from './openai.js';

export type Turn = {
  role: 'user' | 'model';
} & (
  | {
      kind: 'text';
      text: string | AsyncIterable<string>;
    }
  | {
      kind: 'error';
      error: unknown;
    }
);

export type ResolvedConversationTurn = Turn & {kind: 'text'};

export class Conversation {
  readonly turns = new SignalArray<Turn>();
  readonly #lock = new Lock();
  #model = 'openai';

  async send(message: string) {
    await this.#lock.do(async () => {
      this.turns.push({kind: 'text', role: 'user', text: message});
      // TODO(aomarks) Support for loading indicators (another field on Turn).
      this.turns.push({kind: 'text', role: 'model', text: '...'});
      const result = await this.#generate();
      this.turns.pop();
      if (result.ok) {
        this.turns.push({
          kind: 'text',
          role: 'model',
          text: new BufferedMultiplexStream(result.value),
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

  async #generate(): Promise<Result<AsyncIterableIterator<string>, Error>> {
    if (this.#model === 'gemini') {
      return this.#generateGemini();
    }
    if (this.#model === 'openai') {
      return this.#generateOpenai();
    }
    throw new Error('Unknown model: ' + this.#model);
  }

  async #generateGemini(): Promise<
    Result<AsyncIterableIterator<string>, Error>
  > {
    return await gemini(
      {
        contents: await this.#contents(),
        tools: [{functionDeclarations: [getWikipediaArticle.declaration]}],
      },
      [getWikipediaArticle],
      (tool, args, result) => {
        console.log('Tool invoked:', tool, args, result);
        void this.send('Tool response: ' + JSON.stringify(result));
      },
    );
  }

  async #generateOpenai(): Promise<
    Result<AsyncIterableIterator<string>, Error>
  > {
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
      (tool, args, result) => {
        console.log('Tool invoked:', tool, args, result);
        void this.send('Tool response: ' + JSON.stringify(result));
      },
    );
  }

  async #contents(): Promise<Content[]> {
    const contents: Content[] = [];
    for (const turn of this.turns) {
      if (turn.kind !== 'text') {
        continue;
      }
      const textOrStream = turn.text;
      // TODO(aomarks) These eslint warning seem totally off base, what's going on?
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const text =
        typeof textOrStream === 'string'
          ? textOrStream
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            (await Array.fromAsync(textOrStream)).join('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      contents.push({role: turn.role, parts: [{text}]});
    }
    return contents;
  }
}

function convertToOpenai(contents: Content[]): Message[] {
  const messages: Message[] = [];
  for (const content of contents) {
    messages.push({
      role: content.role === 'user' ? 'user' : 'system',
      content: content.parts
        .filter((part) => 'text' in part)
        .map((part) => part.text)
        .join(''),
    });
    console.log(messages.at(-1));
  }
  return messages;
}
