/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SignalArray} from 'signal-utils/array';
import {getWikipediaArticle} from '../tools/wikipedia.js';
import {BufferedMultiplexStream} from '../util/buffered-multiplex-stream.js';
import {gemini, type Content} from './gemini.js';

export interface StreamableContent {
  role: 'user' | 'model';
  text: string | AsyncIterable<string>;
}

export type ResolvedConversationTurn = StreamableContent & {text: string};

export class Conversation {
  readonly contents = new SignalArray<StreamableContent>();

  async send(message: string) {
    // TODO(aomarks) We don't fully serialize requests. Make a proper queue.
    this.contents.push({role: 'user', text: message});
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
    if (result.ok) {
      // TODO(aomarks) Create the bot response earlier so it can be rendered right away.
      this.contents.push({
        role: 'model',
        text: new BufferedMultiplexStream(result.value),
      });
    } else {
      this.contents.push({role: 'model', text: 'An error occured'});
    }
  }

  async #contents(): Promise<Content[]> {
    const contents: Content[] = [];
    for (const {role, text: textOrStream} of this.contents) {
      // TODO(aomarks) These eslint warning seem totally off base, what's going on?
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const text =
        typeof textOrStream === 'string'
          ? textOrStream
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            (await Array.fromAsync(textOrStream)).join('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      contents.push({role, parts: [{text}]});
    }
    return contents;
  }
}
