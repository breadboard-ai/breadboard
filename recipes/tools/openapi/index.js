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
        .filter((method) => ["post", "get"].includes(method))
        .map((method) => {
          // Operation ID might not exist.
          const operationId =
            value[method].operationId ||
            inferOperationId(key, method, value[method]);

          const data = value[method];

          // All parameters, path or query are held in the parameters array ( but might be a reference)
          const parameters =
            "parameters" in data == false
              ? []
              : data.parameters.map((param) => {
                  // We can only manage reference objects for now.
                  if ("$ref" in param) {
                    if (param.$ref.startsWith("#") == false) {
                      return undefined;
                    }

                    const pathParts = param.$ref.replace(/^#\//, "").split("/");
                    let obj = json;

                    for (const part of pathParts) {
                      obj = obj[part];
                    }

                    return obj;
                  } else {
                    return param;
                  }
                });

          const requestBody =
            "requestBody" in data == false
              ? undefined
              : Object.entries(data.requestBody.content)
                  .map(([contentType, reqeustParams]) => {
                    // We can only manage reference objects for now.
                    if ("$ref" in reqeustParams.schema) {
                      if (reqeustParams.schema.$ref.startsWith("#") == false) {
                        return undefined;
                      }

                      const pathParts = reqeustParams.schema.$ref
                        .replace(/^#\//, "")
                        .split("/");
                      let obj = json;

                      for (const part of pathParts) {
                        obj = obj[part];
                      }

                      contentType.schema = obj;
                    }
                    return { [contentType]: reqeustParams };
                  })
                  .reduce((acc, curr) => {
                    return { ...acc, ...curr };
                  }, {});

          // We will need to hook up `secrets` to this somehow.
          let secrets = undefined;
          // We can only support Bearer tokens for now.
          if ("components" in json && "securitySchemes" in json.components) {
            // Check to see if global security is defined, it's the same type and && it is a bearer token.
            const bearerSecurity = Object.entries(
              json.components.securitySchemes
            ).find(([securityMethodKey, securityValue]) => {
              const security = json.security.find((item) => {
                return securityMethodKey in item;
              });

              return (
                security &&
                securityValue.type == "http" &&
                securityValue.scheme == "bearer"
              );
            });

            if (bearerSecurity != undefined) {
              secrets = bearerSecurity;
            }
          }

          const headers = {
            operationId,
            url: baseUrl.replace(/\/$/, "") + key,
            method: method.toUpperCase(),
            description: data.description,
            summary: data.summary,
            parameters,
            requestBody,
            secrets,
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
const createSpecRecipe = recipe((api) => {
  const output = base.output({});
  api.item.to(output);
  return api.item
    .to(
      recipe((item) => {
        const getItem = code((itemToSplat) => {
          const { input, api_inputs } = itemToSplat;
          const { method, parameters, secrets, requestBody } = itemToSplat.item;
          let { url } = itemToSplat.item;

          const queryStringParameters = {};

          if (
            parameters != undefined &&
            parameters.length > 0 &&
            input == undefined
          ) {
            throw new Error(
              `Missing input for parameters ${JSON.stringify(parameters)}`
            );
          }

          for (const param of parameters) {
            if (input && param.name in input == false && param.required) {
              throw new Error(`Missing required parameter ${param.name}`);
            }

            if (input && param.name in input == false) {
              // Parameter is not required and not in input, so we can skip it.
              continue;
            }

            if (param.in == "path") {
              // Replace the path parameter with the value from the input.
              url = url.replace(`{${param.name}}`, input[param.name]);
            }

            if (param.in == "query") {
              queryStringParameters[param.name] = input[param.name];
            }
          }

          // // If the method is POST or PUT, then we need to add the requestBody to the body.

          // We are going to want to add in the secret somehow
          const headers = {};

          // Create the query string
          const queryString = Object.entries(queryStringParameters)
            .map((key, value) => {
              return `${key}=${value}`;
            })
            .join("&");

          if (queryString.length > 0) {
            url = `${url}?${queryString}`;
          }

          if (secrets != undefined) {
            // We know that we currently only support Bearer tokens.
            const envKey = api_inputs.bearer;
            const envValue = itemToSplat[envKey];
            headers["Authorization"] = `Bearer ${envValue}`;
          }

          let body = undefined;

          if (requestBody) {
            // We know the method needs a request Body.
            // Find the first input that matches the valid required schema of the API.
            let requestContentType;

            for (const requiredContentType of Object.keys(requestBody)) {
              if (requiredContentType in api_inputs) {
                body = api_inputs[requiredContentType];
                requestContentType = requiredContentType;
                break;
              }
            }

            if (body == undefined) {
              throw new Error(
                `Missing required request body for ${JSON.stringify(
                  requestBody
                )}`
              );
            }

            headers["Content-Type"] = requestContentType;
          }
          return { url, method, headers, body, queryString };
        });

        const itemData = getItem(item);

        return starter
          .fetch()
          .in(itemData)
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

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: inputSchema });

  // Get the Open API spec from the given URL
  const fetchOpenAPISpec = input.url.to(starter.fetch()).response.as("json");

  return fetchOpenAPISpec
    .to(validateIsOpenAPI({ $id: "isOpenAPI" }))
    .to(generateAPISpecs({ $id: "generateAPISpecs" }))
    .to(core.map({ $id: "createFetchBoards", board: createSpecRecipe }))
    .to(convertBoardListToObject({ $id: "convertBoardListToObject" }));
}).serialize(metaData);
