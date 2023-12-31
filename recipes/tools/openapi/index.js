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

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: inputSchema });

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

    const inferOperationId = (path, method, values) => {
      // If there is no operation ID, generate one from the path, but format it like a JS function name
      let newName = path
        .split("/")
        .map((part) =>
          part.length == 0 ? part : part[0].toUpperCase() + part.slice(1)
        )
        .join("")
        .replace(/[.-]/g, "") // Remove dashes and dots
        .replace(/[{}]/g, ""); // Remove curly braces (need to improve this)

      return `${method}${newName}`;
    };

    const apis = Object.entries(paths)
      .map(([key, value]) => {
        return Object.keys(value)
          .map((method) => {
            // Operation ID might not exist.
            const operationId =
              value[method].operationId ||
              inferOperationId(key, method, value[method]);

            const headers = {
              operationId,
              url: baseUrl.replace(/\/$/, "") + key,
              method: method.toUpperCase(),
            };

            return headers;
          })
          .flat();
      })
      .flat();

    return { list: apis };
  });

  const specRecipe = recipe((api) => {
    const output = base.output({});
    api.item.to(output);
    return api.item
      .to(
        recipe((item) => {
          const secretSplat = code((itemToSplat) => {
            return { ...itemToSplat.item };
          });

          return starter
            .fetch()
            .in(secretSplat(item))
            .response.as("api_json_response")
            .to(base.output({}));
        })
      )
      .as("board")
      .to(output);
  });

  const splatBoards = code(({ list }) => {
    const operations = list
      .map((item) => {
        return {
          [item.item.operationId]: item.board,
        };
      })
      .reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {});
    return { ...operations };
  });

  const fetchJSON = input.to(starter.fetch()).response.as("json");

  fetchJSON.to(isOpenAPI({ $id: "isOpenAPI" }));

  return fetchJSON
    .to(generateAPISpecs({ $id: "generateAPISpecs" }))
    .to(core.map({ $id: "createFetchBoards", board: specRecipe }))
    .to(splatBoards({ $id: "splatBoards" }));
}).serialize(metaData);
