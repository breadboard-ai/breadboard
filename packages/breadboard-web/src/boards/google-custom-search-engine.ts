/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphInlineMetadata,
  Schema,
  base,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { spread } from "../utils/spread";
import { pop } from "../utils/pop";

const PARAM = {
  QUERY: "query",
  CSE: {
    API_KEY: "CSE_API_KEY",
    ID: "CSE_ID",
    LANG: "CSE_LANG",
    SAFE: "CSE_SAFE",
    NUM: "CSE_NUM",
    START: "CSE_START",
  },
} as const;

const input = base.input({
  $metadata: {
    title: "Input Parameters",
  },
  $id: "input",
  schema: {
    type: "object",
    properties: {
      [PARAM.QUERY]: {
        type: "string",
        title: "Query",
        description: "What would you like to search for?",
        default: "Google Breadboard",
        examples: [
          "Google Breadboard",
          "Google Custom Search Engine",
          "Google Gemini",
        ],
      },
      [PARAM.CSE.NUM]: {
        description: [
          `Number of search results to return`,
          `Valid values are integers between 1 and 10, inclusive.`,
        ].join("\n"),
        title: "Number of results",
        type: "integer",
        default: "3",
      },
      [PARAM.CSE.LANG]: {
        title: "Language",
        description: "Search language",
        type: "string",
        enum: [
          "lang_ar",
          "lang_bg",
          "lang_ca",
          "lang_cs",
          "lang_da",
          "lang_de",
          "lang_el",
          "lang_en",
          "lang_es",
          "lang_et",
          "lang_fi",
          "lang_fr",
          "lang_hr",
          "lang_hu",
          "lang_id",
          "lang_is",
          "lang_it",
          "lang_iw",
          "lang_ja",
          "lang_ko",
          "lang_lt",
          "lang_lv",
          "lang_nl",
          "lang_no",
          "lang_pl",
          "lang_pt",
          "lang_ro",
          "lang_ru",
          "lang_sk",
          "lang_sl",
          "lang_sr",
          "lang_sv",
          "lang_tr",
          "lang_zh-CN",
          "lang_zh-TW",
        ],
        default: "lang_en",
      },
      [PARAM.CSE.SAFE]: {
        title: "Safe search",
        description: "Search safety level",
        type: "string",
        enum: ["active", "off"],
        default: "active",
      },
      [PARAM.CSE.START]: {
        title: "Start index",
        description: [
          "The index of the first result to return.",
          "The default number of results per page is 10, so &start=11 would start at the top of the second page of results.",
          "Note: The JSON API will never return more than 100 results, even if more than 100 documents match the query, so setting the sum of start + num to a number greater than 100 will produce an error.",
        ].join("\n"),
        type: "integer",
        default: "1",
      },
    },
  } satisfies Schema,
});

const secrets = core.secrets({
  $metadata: {
    title: "Secrets",
  },
  $id: "secrets",
  keys: [PARAM.CSE.ID, PARAM.CSE.API_KEY],
});
const urlTemplate = templates.urlTemplate({
  $metadata: {
    title: "CSE URL Template",
  },
  $id: "customSearchURL",
  template: `https://www.googleapis.com/customsearch/v1?key={${PARAM.CSE.API_KEY}}&cx={${PARAM.CSE.ID}}&q={${PARAM.QUERY}}&lr={${PARAM.CSE.LANG}}&safe={${PARAM.CSE.SAFE}}&num={${PARAM.CSE.NUM}}&start={${PARAM.CSE.START}}`,
  [PARAM.CSE.API_KEY]: secrets[PARAM.CSE.API_KEY],
  [PARAM.CSE.ID]: secrets[PARAM.CSE.ID],
  [PARAM.QUERY]: input[PARAM.QUERY],
  [PARAM.CSE.LANG]: input[PARAM.CSE.LANG],
  [PARAM.CSE.SAFE]: input[PARAM.CSE.SAFE],
  [PARAM.CSE.NUM]: input[PARAM.CSE.NUM],
  [PARAM.CSE.START]: input[PARAM.CSE.START],
});

const fetch = core.fetch({
  $metadata: {
    title: "Fetch search results",
  },
  $id: "search",
  url: urlTemplate.url,
});

const spreadResponse = spread({
  $metadata: {
    title: "Spread search response",
  },
  $id: "spreadResponse",
  object: fetch.response,
});

const popSearchResult = pop({
  $metadata: {
    title: "Pop search result",
  },
  array: spreadResponse.items as unknown as object[],
  $id: "popSearchResult",
});

popSearchResult.array.to(popSearchResult);

const spreadSearchResult = spread({
  $metadata: {
    title: "Spread search result",
  },
  $id: "spreadSearchResult",
  object: popSearchResult.item,
});

const output = base.output({
  $metadata: {
    title: "Output",
  },
  $id: "output",
  schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        title: "Page Title",
      },
      htmlTitle: {
        type: "string",
        title: "HTML Title",
      },
      link: {
        type: "string",
        title: "Link",
      },
      displayLink: {
        type: "string",
        title: "Display Link",
      },
      snippet: {
        type: "string",
        title: "Snippet",
      },
      htmlSnippet: {
        type: "string",
        title: "HTML Snippet",
      },
      formattedUrl: {
        type: "string",
        title: "Formatted URL",
      },
      htmlFormattedUrl: {
        type: "string",
        title: "HTML Formatted URL",
      },
      pagemap: {
        title: "Page Map",
        type: "object",
        properties: {
          cse_thumbnail: {
            type: "array",
            items: [
              {
                type: "object",
                properties: {
                  src: {
                    type: "string",
                  },
                  width: {
                    type: "string",
                  },
                  height: {
                    type: "string",
                  },
                },
                required: ["src", "width", "height"],
              },
            ],
          },
          softwaresourcecode: {
            type: "array",
            items: [
              {
                type: "object",
                properties: {
                  author: {
                    type: "string",
                  },
                  name: {
                    type: "string",
                  },
                  text: {
                    type: "string",
                  },
                },
                required: ["author", "name", "text"],
              },
            ],
          },
          metatags: {
            type: "array",
            items: [
              {
                type: "object",
              },
            ],
          },
          cse_image: {
            type: "array",
            items: [
              {
                type: "object",
                properties: {
                  src: {
                    type: "string",
                  },
                },
                required: ["src"],
              },
            ],
          },
        },
        required: [
          "cse_thumbnail",
          "softwaresourcecode",
          "metatags",
          "cse_image",
        ],
      },
    },
    required: [
      "kind",
      "title",
      "htmlTitle",
      "link",
      "displayLink",
      "snippet",
      "htmlSnippet",
      "formattedUrl",
      "htmlFormattedUrl",
      "pagemap",
    ],
  } satisfies Schema,
});

spreadSearchResult.to(output);

export default await input.serialize({
  title: "Google Custom Search Engine Tool",
  description: [
    "A tool to search for information using the Google Custom Search Engine",
    "For more information, see the Google Custom Search Engine documentation.",
    "https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list",
  ].join("\n"),
  version: "0.1.0",
} satisfies GraphInlineMetadata);
