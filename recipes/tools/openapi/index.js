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

  const validateIsOpenAPI = code(({ json }) => {
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

  /*
    Generate a list of API operations from the given Open API spec that will be used to create the board of boards.
  */
  const generateAPISpecs = code(({ json }) => {
    const { paths } = json;
    const baseUrl = json.servers[0].url;

    /*
      If there is no operation ID, we need to generate one from the path, but format it like a JS function name.
    */
    const inferOperationId = (path, method) => {
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

  /*
    Returns a lambda that will make a request to the given API. This is used in the `core.map` to create a board of boards for each API exposed on the OpenAPI spec.
  */
  const specRecipe = recipe((api) => {
    const output = base.output({});
    api.item.to(output);
    return api.item
      .to(
        recipe((item) => {
          const getItem = code((itemToSplat) => {
            return { ...itemToSplat.item };
          });

          return starter
            .fetch()
            .in(getItem(item))
            .response.as("api_json_response")
            .to(base.output({}));
        })
      )
      .as("board")
      .to(output);
  });

  /*
    Because we need a nice interface on the board that calls this, we need to convert from a list to an object. This will then enable something like `core.invoke().API_NAME_YOU_WANT_CALL`.
  */
  const convertBoardListToObject = code(({ list }) => {
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

  // Get the Open API spec from the given URL
  const fetchOpenAPISpec = input.to(starter.fetch()).response.as("json");

  // Validate that the given URL is an Open API spec that we can parse.
  // YAML spec files will fail this.
  fetchOpenAPISpec.to(validateIsOpenAPI({ $id: "isOpenAPI" }));

  return fetchOpenAPISpec
    .to(generateAPISpecs({ $id: "generateAPISpecs" }))
    .to(core.map({ $id: "createFetchBoards", board: specRecipe }))
    .to(convertBoardListToObject({ $id: "convertBoardListToObject" }));
}).serialize(metaData);
