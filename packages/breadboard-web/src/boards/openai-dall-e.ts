/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const makeHeaders = code(({ key }) => {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
  };
});

const makeBody = code(({ prompt }) => {
  return {
    body: { model: "dall-e-3", prompt, response_format: "b64_json" },
  };
});

const extractResponse = code(({ response }) => {
  const { data } = response as { data: { b64_json: string }[] };
  return {
    response: {
      inline_data: { data: data[0].b64_json, mime_type: "image/png" },
    },
  };
});

export default await board(({ prompt }) => {
  prompt
    .isString()
    .title("Prompt")
    .description("The prompt to generate images from.")
    .examples("A painting of a breadboard");

  const headerMaker = makeHeaders({
    $metadata: {
      title: "Make Headers",
      description: "Make the headers for the API request",
    },
    key: core.secrets({
      $metadata: {
        title: "API Key",
        description: "The API key for the OpenAI DALL·E API.",
      },
      keys: ["OPENAI_API_KEY"],
    }).OPENAI_API_KEY,
  });

  const bodyMaker = makeBody({
    $metadata: {
      title: "Make Body",
      description: "Make the body for the API request",
    },
    prompt,
  });

  const dalleCaller = core.fetch({
    $metadata: {
      title: "Call OpenAI DALL·E",
      description: "Call the OpenAI DALL·E API to generate images from text.",
    },
    url: "https://api.openai.com/v1/images/generations",
    method: "POST",
    headers: headerMaker.headers,
    body: bodyMaker.body,
  });

  const responseExtractor = extractResponse({
    $metadata: {
      title: "Extract Response",
      description: "Extract the response from the API call",
    },
    response: dalleCaller.response,
  });

  const response = responseExtractor.response.isObject().format("image");

  return { response };
}).serialize({
  title: "OpenAI DALL·E",
  description:
    "This board is the simplest possible invocation of OpenAI's DALL·E API to generate images from text.",
  version: "0.0.1",
});
