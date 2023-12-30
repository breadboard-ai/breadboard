/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Create a board from an Open API spec",
  description: "Converts an Open API spec to a board.",
  version: "0.0.3",
};

const inputSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      title: "Open API URL",
      description:
        "The URL of the Open API spec that you want to convert to a board.",
    },
  },
};

const outputSchema = {
  type: "object",
  properties: {
    board: {
      type: "object",
      title: "Board",
      description: "The board that was created from the Open API spec.",
    },
  },
};

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: inputSchema });
  const output = base.output({ $id: "output", schema: outputSchema });

  const isOpenAPI = code(({ json }) => {
    if ("openapi" in json == false) {
      throw new Error("Not an Open API spec.");
    }

    if ("servers" in json == false) {
      throw new Error("No servers in Open API spec.");
    }

    if ("paths" in json == false) {
      throw new Error("No paths in Open API spec.");
    }

    return { json };
  });

  const generateAPISpecs = code(({ json }) => {
    const { paths } = json;
    const baseUrl = json.servers[0].url;

    // We can only really handle GET requests right now.
    const apis = Object.entries(paths)
      .map(([key, value]) => {
        return Object.keys(value)
          .map((method) => {
            const headers = {
              //[value[method].operationId]: {
              operationId: value[method].operationId,
              url: baseUrl + key,
              method: method.toUpperCase(),
              // },
            };

            return headers;
          })
          .flat();
      })
      .flat();
    // .reduce((acc, curr) => {
    //   return { ...acc, ...curr };
    // }, {});

    return { apis };
  });

  const specRecipe = recipe((api) => {
    const output = base.output({});
    api.item.to(output);
    return api
      .to(
        recipe((i) => {
          return starter
            .fetch({
              $id: i.operationId,
              url: i.url,
              method: i.method,
            })
            .response.as("json")
            .to(base.output({}));
        })
      )
      .as("board")
      .to(output);
  });

  const splatBoards = code(({ list }) => {
    const opeations = list
      .map((item) => {
        return {
          [item.item.operationId]: item.board,
        };
      })
      .reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {});
    return { ...opeations };
  });

  starter
    .fetch({ url: input.url })
    .response.as("json")
    .to(isOpenAPI())
    .json.to(generateAPISpecs())
    .apis.as("list")
    .to(core.map({ board: specRecipe }))
    .list.to(splatBoards())
    .to(output);

  return output;
}).serialize(metaData);
