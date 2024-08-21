/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphInlineMetadata,
  Schema,
  base,
  board,
  code,
} from "@google-labs/breadboard";
import { templates } from "@google-labs/template-kit";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { nursery } from "@google-labs/node-nursery-web";

const metadata = {
  title: "Gemini Pro Vision",
  description: "A simple example of using `gemini-pro-vision` model",
  version: "0.0.2",
} satisfies GraphInlineMetadata;

const inputSchema = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      title: "Content",
      description: "Add content here",
      minItems: 1,
      items: {
        type: "object",
        behavior: ["llm-content"],
        format: "image-file,image-webcam",
      },
    },
    useStreaming: {
      type: "boolean",
      title: "Stream",
      description: "Whether to stream the output",
      default: "false",
    },
  },
  required: ["parts"],
} satisfies Schema;

const errorOutputSchema = {
  type: "object",
  properties: {
    error: {
      type: "string",
      title: "Error",
    },
  },
} satisfies Schema;

const streamOutputSchema = {
  properties: {
    stream: {
      type: "object",
      title: "Result",
      format: "stream",
    },
  },
} satisfies Schema;

const textOutputSchema = {
  type: "object",
  properties: {
    result: {
      type: "string",
      title: "Result",
    },
  },
} satisfies Schema;

export default await board(() => {
  const parameters = base.input({ $id: "parameters", schema: inputSchema });

  const makeBody = json.jsonata({
    $id: "makeBody",
    expression: `{ "contents": $.parts[0] }`,
    parts: parameters,
  });

  function chooseMethodFunction({ useStreaming }: { useStreaming: boolean }) {
    const method = useStreaming ? "streamGenerateContent" : "generateContent";
    const sseOption = useStreaming ? "&alt=sse" : "";
    return { method, sseOption };
  }

  const chooseMethod = core.runJavascript({
    $id: "chooseMethod",
    name: "chooseMethodFunction",
    code: chooseMethodFunction.toString(),
    raw: true,
    useStreaming: parameters,
  });

  const makeUrl = templates.urlTemplate({
    $id: "makeURL",
    template:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:{method}?key={GEMINI_KEY}{+sseOption}",
    GEMINI_KEY: core.secrets({ keys: ["GEMINI_KEY"] }),
    method: chooseMethod,
    sseOption: chooseMethod,
  });

  const fetch = core.fetch({
    method: "POST",
    stream: parameters.useStreaming,
    url: makeUrl.url,
    body: makeBody.result,
  });

  fetch.$error
    .as("json")
    .to(
      json.jsonata({
        $id: "formatError",
        expression: "error.message",
      })
    )
    .result.as("error")
    .to(base.output({ $id: "errorOutput", schema: errorOutputSchema }));

  const chunkToText = nursery.transformStream({
    $id: "chunkToText",
    board: board(() => {
      type Chunky = {
        chunk: {
          candidates: {
            content: { parts: { text: string }[] };
          }[];
        };
      };

      return base
        .input({})
        .chunk.to(
          code(({ chunk }: Chunky) => {
            return {
              chunk: chunk.candidates[0].content.parts[0].text,
            };
          })()
        )
        .to(base.output({}));
    }),
    stream: fetch.stream,
  });

  base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
    stream: chunkToText,
  });

  return json
    .jsonata({
      $id: "formatOutput",
      expression: "$join(candidates.content.parts.text)",
      json: fetch.response,
    })
    .result.to(
      base.output({
        $id: "textOutput",
        schema: textOutputSchema,
      })
    );
}).serialize(metadata);
