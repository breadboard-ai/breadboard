/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import {getWikipediaArticle} from '../tools/wikipedia.js';
import {BufferedMultiplexStream} from '../util/buffered-multiplex-stream.js';
import {Lock} from '../util/lock.js';
import {gemini, type Content} from './gemini.js';

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

  async send(message: string) {
    await this.#lock.do(async () => {
      this.turns.push({kind: 'text', role: 'user', text: message});
      // TODO(aomarks) Support for loading indicators (another field on Turn).
      this.turns.push({kind: 'text', role: 'model', text: '...'});
      const result = await gemini(
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
