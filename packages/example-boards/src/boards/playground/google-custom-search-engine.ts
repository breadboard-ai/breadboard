/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { array, board, enumeration, input, object, output } from "@breadboard-ai/build";
import { code, fetch, secret } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { createSpreadCode } from "../../utils/newSpread";

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

const query = input({
  type: "string",
  title: "Query",
  description: "What would you like to search for?",
  default: "Google Breadboard",
  examples: [
    "Google Breadboard",
    "Google Custom Search Engine",
    "Google Gemini",
  ],
});

const numberOfResults = input({
  description: [
    `Number of search results to return`,
    `Valid values are integers between 1 and 10, inclusive.`,
  ].join("\n"),
  title: "Number of results",
  type: "number",
  default: 3,
});

const language = input({
  title: "Language",
  description: "Search language",
  type: enumeration(
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
  ),
  default: "lang_en",
});

const safeSearch = input({
  title: "Safe search",
  description: "Search safety level",
  type: enumeration("active", "off"),
  default: "active",
});

const startIndex = input({
  title: "Start index",
  description: [
    "The index of the first result to return.",
    "The default number of results per page is 10, so &start=11 would start at the top of the second page of results.",
    "Note: The JSON API will never return more than 100 results, even if more than 100 documents match the query, so setting the sum of start + num to a number greater than 100 will produce an error.",
  ].join("\n"),
  type: "number",
  default: 1,
});

const secretId = secret(PARAM.CSE.ID);

const secretApiKey = secret(PARAM.CSE.API_KEY)

const url = urlTemplate({
  $metadata: {
    title: "CSE URL Template",
  },
  $id: "customSearchURL",
  template: `https://www.googleapis.com/customsearch/v1?key={${PARAM.CSE.API_KEY}}&cx={${PARAM.CSE.ID}}&q={${PARAM.QUERY}}&lr={${PARAM.CSE.LANG}}&safe={${PARAM.CSE.SAFE}}&num={${PARAM.CSE.NUM}}&start={${PARAM.CSE.START}}`,
  [PARAM.CSE.API_KEY]: secretApiKey,
  [PARAM.CSE.ID]: secretId,
  [PARAM.QUERY]: query,
  [PARAM.CSE.LANG]: language,
  [PARAM.CSE.SAFE]: safeSearch,
  [PARAM.CSE.NUM]: numberOfResults,
  [PARAM.CSE.START]: startIndex,
});

const fetchResult = fetch({
  $metadata: {
    title: "Fetch search results",
  },
  $id: "search",
  url: url.outputs.url,
});

const spreadResponse = createSpreadCode(fetchResult.outputs.response, { items: array(object({})) })

const spreadSearchResult = code(
  {
    $id: "spreadFinals",
    $metadata: {
      title: "Spread Final",
      description: "Spread the properties of an object into a new object",
    },
    obj: spreadResponse.outputs.items
  },
  {
    results: array(object({
      title: "string",
      htmlTitle: "string",
      link: "string",
      displayLink: "string",
      snippet: "string",
      htmlSnippet: "string",
      formattedUrl: "string",
      htmlFormattedUrl: "string",
      pagemap: object({
        cse_thumbnail: array(object({
          src: "string",
          height: "string",
          width: "string",
        })),
        softwaresourcecode: array(object({
          author: "string",
          name: "string",
          text: "string",
        })),
        metatags: array(object({})),
        cse_image: array(object({
          src: "string",
        })),
      })
    }))
  },
  ({ obj }) => {
    if (typeof obj !== "object") {
      throw new Error(`object is of type ${typeof obj} not object`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { results: { ...obj } } as any;
  }
);

export default board({
  title: "Google Custom Search Engine Tool",
  description: [
    "A tool to search for information using the Google Custom Search Engine",
    "For more information, see the Google Custom Search Engine documentation.",
    "https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list",
  ].join("\n"),
  version: "0.2.0",
  inputs: { query, numberOfResults, language, safeSearch, startIndex },
  outputs: {
    results: output(spreadSearchResult.outputs.results)
  },
});