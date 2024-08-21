/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

const spread = code<{ object: object }>((inputs) => {
  const object = inputs.object;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  return { ...object };
});

const graph = board(() => {
  const input = base.input({
    $id: "query",
    type: "object",
    schema: {
      properties: {
        requestUri: {
          type: "string",
          title: "Request URI",
          default: "works/random",
        },
      },
      type: "object",
      required: ["requestUri"],
      additionalProperties: false,
    },
  });

  const urlTemplate = templates.urlTemplate({
    $id: "urlTemplate",
    template: "https://api.openalex.org/{requestUri}",
    requestUri: input.requestUri,
  });

  const fetchUrl = core.fetch({
    $id: "fetch",
    method: "GET",
    url: urlTemplate.url,
  });

  const response = spread({ $id: "spreadResponse", object: fetchUrl.response });

  const output = base.output({
    $id: "result",
    ...response,
  });
  return output;
});

export default await graph.serialize({
  title: "Open Alex API Query",
  description: "Query the Open Alex API",
  version: "0.0.1",
});
