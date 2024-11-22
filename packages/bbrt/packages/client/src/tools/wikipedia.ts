/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';
import type {BBRTTool} from './tool.js';

export const getWikipediaArticle: BBRTTool<
  {title: string},
  {wikitext: string} | {error: string}
> = {
  displayName: 'Get Wikipedia Article',
  icon: '/images/wikipedia.png',
  declaration: () => ({
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
  }),

  render: ({title}) => html`
    <span>Read Wikipedia Article</span>
    <em
      ><a
        href="https://en.wikipedia.org/wiki/${title}"
        target="_blank"
        referrerpolicy="no-referrer"
        >${title.replace(/_/g, ' ')}</a
      ></em
    >
  `,

  invoke: async ({title}) => {
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
        return {ok: false, error: `HTTP status: ${result.status}`};
      }
      json = (await result.json()) as {
        parse?: {
          wikitext?: {
            '*'?: string;
          };
        };
      };
    } catch (e) {
      return {ok: false, error: `HTTP error: ${String(e)}`};
    }
    const wikitext = json?.parse?.wikitext?.['*'];
    if (!wikitext) {
      return {ok: false, error: 'No wikitext found'};
    }
    return {ok: true, value: {wikitext: wikitext.slice(0, 5000)}};
  },
};
