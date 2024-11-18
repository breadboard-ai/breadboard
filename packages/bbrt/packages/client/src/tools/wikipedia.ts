/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Tool} from './tool.js';

export const getWikipediaArticle: Tool<
  {title: string},
  {wikitext: string} | {error: string}
> = {
  displayName: 'Get Wikipedia Article',
  icon: '/images/wikipedia.png',
  declaration: {
    name: 'get_wikipedia_article',
    description:
      'Fetches the contents of a Wikipedia article, formatted as wikitext. ' +
      'Wikitext is very close to normal prose, so it does not need further parsing. ' +
      'This wikitext can be used as reference to answer questions the user may have, or as context for further discussion.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          description:
            'The title of the Wikipedia article to fetch as it would apear in a URL parameter (e.g. Barack_Obama) ',
          type: 'string',
        },
      },
    },
  },

  invoke: async ({title}) => {
    console.log('INVOKE', title);
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('page', title);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('prop', 'wikitext');
    url.searchParams.set('format', 'json');
    url.searchParams.set('redirects', '1');
    url.searchParams.set('origin', '*');
    let json;
    try {
      const result = await fetch(url.href);
      if (result.status !== 200) {
        return {error: `HTTP status: ${result.status}`};
      }
      json = (await result.json()) as {
        parse?: {
          wikitext?: {
            '*'?: string;
          };
        };
      };
    } catch (e) {
      return {error: `HTTP error: ${String(e)}`};
    }
    const wikitext = json?.parse?.wikitext?.['*'];
    if (!wikitext) {
      return {error: 'No wikitext found'};
    }
    return {wikitext: wikitext.slice(0, 5000)};
  },
};
