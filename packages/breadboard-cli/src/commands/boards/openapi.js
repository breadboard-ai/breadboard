/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Create a board from an Open API spec",
  description: "Converts an Open API spec to a board.",
  version: "0.0.3",
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
  const { paths, info } = json;
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
      // Parse parameters on the path
      let pathParameters = [];
      if ("parameters" in value) {
        pathParameters = value.parameters.map((param) => {
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
      }

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

          parameters.push(...pathParameters);

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

                      if ("description" in obj == false) {
                        obj.description = `Request POST data (format: ${contentType})`;
                      }
                      return { [contentType]: { schema: obj } };
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
            info,
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
const createSpecBoard = board((apiSpec) => {
  const output = base.output({});

  const createBoardInputs = code(({ item }) => {
    const { parameters } = item;
    const nodes = [];

    const inputNode = {
      id: `input`,
      type: `input`,
      configuration: {
        schema: {
          type: "object",
          properties: parameters.reduce((params, param) => {
            const schema = { ...param.schema };
            schema.title = param.name;
            schema.description = param.description || param.schema.title;

            if (param.required) {
              if ("default" in param == false) {
                schema.default = undefined;
              } else {
                schema.default = param.default;
              }
            } else {
              schema.default = param.default || null;
            }

            if (param.in == "query" || param.in == "path") {
              params[param.name] = schema;
            }

            return params;
          }, {}),
        },
      },
    };

    nodes.push(inputNode);

    nodes.push({ id: "output", type: "output" });

    const edges = parameters.map((param) => {
      return {
        from: `input`,
        out: param.name,
        to: "output",
        in: param.name,
        optional: !param.required,
      };
    });

    if (
      "requestBody" in item &&
      item.requestBody != undefined &&
      "application/json" in item.requestBody
    ) {
      // Only support JSON Schema for now.  If you need XML, talk to Paul.
      nodes.push({
        id: "input-requestBody",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              requestBody: {
                type: "object",
                title: "requestBody",
                description:
                  item.requestBody["application/json"].description ||
                  "The request body for the API call (JSON)",
              },
            },
          },
        },
      });

      edges.push({
        from: "input-requestBody",
        out: "requestBody",
        to: "output",
        in: "requestBody",
      });
    }

    if ("secrets" in item && item.secrets != undefined) {
      const apiKeyName = `${item.info.title
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toUpperCase()}_KEY`;

      nodes.push({
        id: "input-secrets",
        type: "secrets",
        configuration: {
          keys: [apiKeyName],
        },
      });

      edges.push({
        from: "input-secrets",
        out: apiKeyName,
        to: "output",
        in: apiKeyName,
      });
    }

    if (nodes.length == 0) {
      nodes.push({ id: "input", type: "input" });
    }

    if (edges.length == 0) {
      edges.push({ from: `input`, out: "*", to: "output", in: "" });
    }

    const graph = {
      title: `API Inputs for ${item.operationId}`,
      url: "#",
      nodes,
      edges,
    };

    return { graph };
  });

  const graphInputs = apiSpec.item.to(
    createBoardInputs({
      $id: "createBoardInputs",
    })
  );

  const APIEndpoint = board((input) => {
    const { item, graph } = input;
    const toAPIInputs = code((item) => {
      return { api_inputs: item };
    });

    const api_inputs = core
      .invoke({ $id: "APIInput", ...input, graph: graph })
      .to(toAPIInputs({ $id: "toAPIInputs" }));

    const output = base.output({});

    const createFetchParameters = code(({ item, api_inputs }) => {
      const { method, parameters, secrets, requestBody } = item;

      let { url } = item;

      const queryStringParameters = {};

      if (typeof api_inputs == "string") {
        api_inputs = JSON.parse(api_inputs);
      }

      if (
        parameters != undefined &&
        parameters.length > 0 &&
        api_inputs == undefined
      ) {
        throw new Error(
          `Missing input for parameters ${JSON.stringify(parameters)}`
        );
      }

      for (const param of parameters) {
        if (api_inputs && param.name in api_inputs == false && param.required) {
          throw new Error(`Missing required parameter ${param.name}`);
        }

        if (api_inputs && param.name in api_inputs == false) {
          // Parameter is not required and not in input, so we can skip it.
          continue;
        }

        if (param.in == "path") {
          // Replace the path parameter with the value from the input.
          url = url.replace(`{${param.name}}`, api_inputs[param.name]);
        }

        if (param.in == "query") {
          queryStringParameters[param.name] = api_inputs[param.name];
        }
      }

      // If the method is POST or PUT, then we need to add the requestBody to the body.

      // We are going to want to add in the secret somehow
      const headers = {};

      // Create the query string
      const queryString = Object.entries(queryStringParameters)
        .map(([key, value]) => {
          return `${key}=${value}`;
        })
        .join("&");

      if (queryString.length > 0) {
        url = `${url}?${queryString}`;
      }

      // Many APIs will require an authentication token but they don't define it in the Open API spec.
      if (secrets != undefined && secrets[1].scheme == "bearer") {
        const envKey = `${item.info.title
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .toUpperCase()}_KEY`;
        const envValue = api_inputs[envKey];

        headers["Authorization"] = `Bearer ${envValue}`;
      }

      let body = undefined;

      if (requestBody) {
        // We know the method needs a request Body.
        // Find the first input that matches the valid required schema of the API.
        let requestContentType;

        // We can only handle JSON
        if ("requestBody" in api_inputs) {
          body =
            typeof api_inputs["requestBody"] == "string"
              ? JSON.parse(api_inputs["requestBody"])
              : api_inputs["requestBody"];
          requestContentType = "application/json";
        }

        if (body == undefined) {
          throw new Error(
            `Missing required request body for ${JSON.stringify(requestBody)}`
          );
        }

        headers["Content-Type"] = requestContentType;
      }
      return { url, method, headers, body, queryString };
    });

    return createFetchParameters({
      $id: "createFetchParameters",
      item,
      api_inputs,
    })
      .to(core.fetch())
      .response.as("api_json_response")
      .to(output);
  });

  apiSpec.item.to(output);
  graphInputs.to(output);
  graphInputs.to(APIEndpoint);

  return apiSpec.item.to(APIEndpoint).as("board").to(output);
});

/*
  Because we need a nice interface on the board that calls this, we need to convert from a list to an object. This will then enable something like `core.invoke().API_NAME_YOU_WANT_CALL`.
*/
const convertBoardListToObject = code(({ list }) => {
  const operations = list
    .map((item) => {
      return {
        [item.item.operationId]: item,
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {});
  return { ...operations };
});

export default await board(({ json }) => {
  // Get the Open API spec from the given URL.
  return validateIsOpenAPI({ $id: "isOpenAPI", json })
    .to(generateAPISpecs({ $id: "generateAPISpecs" }))
    .to(core.map({ $id: "createFetchBoards", board: createSpecBoard }))
    .to(convertBoardListToObject({ $id: "convertBoardListToObject" }));
}).serialize(metaData);
