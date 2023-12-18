# Gallery of Breadboard Kits

Here is a list of some of the public kits you can use in Breadboard today.

NOTE: Breadboard is built to be flexible, you can [build a kit](./build-a-kit.md) or use existing npm [libraries as kits](./libraries-as-kits.md) or ask a friend for theirs.  You can also `runJavascript` and `fetch` URLs to accomplish quite a bit on your own.

## Breadboard Core Utilities

* [google-labs/llm-starter](https://github.com/breadboard-ai/breadboard/tree/main/seeds/llm-starter)
  is likely to be used in almost every board.
  It exposes the following key node handlers (see docs for more):
  * `runJavascript` use `code` and variables to execute and return a `result`
  * `secrets` access environment variables within your board
  * `promptTemplate` use a `template` and `{{var}}` variables to return a `prompt` string
  * `urlTemplate` use a `template` and `{var}` variables to return a `url` string (based on [URI template spec](https://tools.ietf.org/html/rfc6570))
  * `fetch` use (`url`, `headers`, `raw` (true=text, false=JSON)) to fetch a url and returns `response`
  * `jsonata` use a [JSONata](https://jsonata.org/) `expression` and `json` to extract and return a `result`
  * `xmlToJson` use `xml` and return `json`
* [google-labs/core-kit](https://github.com/breadboard-ai/breadboard/tree/main/seeds/core-kit)
  provides many useful tools for breadboard development as well as more sophisticated board builders.
  It exposes the following key node handlers (see docs for more):
  * `passthrough` node to start a board at a specific input or perform any noop action
  * `append` use `accumulator` to create a history as `string\n...`, `["key: value", ...]` or `{key: value, ...}`
  * `import` use `path` or `graph` to create a lambda board returning `board` which could be used in `invoke`
  * `invoke` use `path`, `graph`, or `board` to run another board passing other inputs and output properties
  * `reflect` returns a `graph` representation of the current board

## LLM Model Inference

* [google-labs/palm-kit](https://github.com/breadboard-ai/breadboard/tree/main/seeds/palm-kit)
  is a convenience wrapper for interactions with the [PaLM APIs](https://developers.generativeai.google/), utilizing a `PALM_KEY` environment variable accessed via `secrets`.
  It exposes the following key node handlers (see docs for more):
  * `generateText` use `text` prompt (optionally `stopSequences`) to generate and return a `completion`
  * `embedText` use `text` to create and return an `embedding` (768-dimensional array of floating-point numbers)

## Vector Database

* [google-labs/pinecode-kit](https://github.com/breadboard-ai/breadboard/tree/main/seeds/pinecone-kit)
  is an early stage prototype for an interaction with the [Pinecone](https://pinecone.io/) vector database.
  See docs for usage.

## Session History

* see the [tutorial](../tutorial/) for how to use the
  [google-labs/core-kit](https://github.com/breadboard-ai/breadboard/tree/main/seeds/core-kit)
  `append` to create a history.
* TODO add some kits...

## API & Tool Usage

* TODO add tutorial on API function calling (via fetch, via OpenAPI spec, via Gemini function calling)
* TODO add some kits...

NOTE: Did you build a useful kit?  Send us a pull request.
