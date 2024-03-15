/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, NodeValue } from "@google-labs/breadboard";
import yaml from "yaml";
import { readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { ImportOptions } from "./commandTypes.js";
import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

function isOpenAPI(
  json: object
): json is OpenAPIV3.Document | OpenAPIV3_1.Document {
  if ("openapi" in json == false) {
    throw new Error("Not an Open API spec.");
  }

  if ("servers" in json == false) {
    throw new Error("No servers in Open API spec.");
  }

  if ("paths" in json == false) {
    throw new Error("No paths in Open API spec.");
  }

  return true;
}

function isReferenceObject(
  obj: object //OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): obj is OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject {
  return "$ref" in obj;
}

type ExcluedRequestBody = Exclude<
  OpenAPIV3_1.RequestBodyObject | OpenAPIV3.RequestBodyObject,
  OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
>;

type ExcludedParameter = Exclude<
  OpenAPI.Parameter,
  OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
>;

type MediaTypeObject = OpenAPIV3_1.MediaTypeObject | OpenAPIV3.MediaTypeObject;

function parseParametersFromRequest<
  D extends OpenAPI.Document<OpenAPIV3.Document | OpenAPIV3_1.Document>,
  P extends
    | OpenAPIV3_1.ReferenceObject
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.RequestBodyObject
    | OpenAPIV3_1.RequestBodyObject,
>(json: D, request: P): ExcluedRequestBody["content"] {
  if (isReferenceObject(request)) {
    return {}; // Can't deal with this yet.
  }

  if (request.content == undefined) {
    return {};
  }
  const requestThing = Object.entries<MediaTypeObject>(request.content).filter(
    ([contentType, requestParams]) => {
      if (requestParams == undefined) {
        return false;
      }

      if (requestParams.schema == undefined) {
        return false;
      }

      if (isReferenceObject(requestParams.schema) == false) {
        return true;
      }

      return requestParams.schema.$ref.startsWith("#");
    }
  );

  const accumulator: ExcluedRequestBody["content"] = {};
  for (const [contentType, requestParams] of requestThing) {
    if (requestParams == undefined || requestParams.schema == undefined) {
      continue;
    }

    if (isReferenceObject(requestParams.schema)) {
      const refKey = requestParams.schema.$ref;

      const pathParts = refKey.replace(/^#\//, "").split("/");
      let obj = json as unknown as Record<string, unknown>;

      if (obj == undefined) {
        throw new Error("No JSON object");
      }

      for (const part of pathParts) {
        obj = obj[part] as Record<string, unknown>;
      }

      if ("description" in obj == false) {
        obj.description = `Request POST data (format: ${contentType})`;
      }

      accumulator[contentType] = {
        schema: requestParams.schema,
      };
    } else {
      accumulator[contentType] = {
        schema: requestParams.schema,
      };
    }
  }
  return accumulator;
}

function parseParametersFromPathOrQueryString<
  D extends OpenAPI.Document<OpenAPIV3.Document | OpenAPIV3_1.Document>,
  P extends OpenAPI.Parameter[],
>(json: D, parameters: P): ExcludedParameter[] {
  return parameters
    .filter((param) => {
      if (isReferenceObject(param) == false) {
        return true;
      }

      return param.$ref.startsWith("#");
    })
    .map((param) => {
      // We can only manage reference objects for now.
      if (isReferenceObject(param)) {
        // We will convert a reference object to a parameter object.
        const pathParts = param.$ref.replace(/^#\//, "").split("/");
        let obj = json as unknown as Record<string, unknown>;

        for (const part of pathParts) {
          obj = obj[part] as Record<string, unknown>;
        }

        return obj as unknown as ExcludedParameter;
      } else {
        return param as unknown as ExcludedParameter;
      }
    }) as ExcludedParameter[];
}
/*
    If there is no operation ID, we need to generate one from the path, but format it like a JS function name.
   */
const inferOperationId = (path: string, method: string) => {
  const newName = path
    .split("/")
    .map((part) =>
      part.length == 0 ? part : part[0].toUpperCase() + part.slice(1)
    )
    .join("")
    .replace(/[.-]/g, "") // Remove dashes and dots
    .replace(/[{}]/g, ""); // Remove curly braces (need to improve this)

  return `${method}${newName}`;
};

const generateAPISpecs = (json: OpenAPIV3.Document) => {
  const { paths, info } = json;

  const baseUrl = json.servers?.[0].url;

  if (baseUrl == undefined) {
    throw new Error("No base URL in Open API spec.");
  }

  const apis: [string, string, OpenAPIV3.OperationObject][] = [];
  // Generate a list of APIs
  for (const apiPath in paths) {
    const pathInfo = paths[apiPath];
    if (pathInfo == undefined) {
      continue;
    }
    if (pathInfo.get != undefined) {
      apis.push([apiPath, "get", pathInfo.get]);
    }
    if (pathInfo.post != undefined) {
      apis.push([apiPath, "post", pathInfo.post]);
    }
  }

  const outputApis = apis.map(([path, method, data]) => {
    if (data instanceof String) return;

    const operationId = data.operationId || inferOperationId(path, method);

    // All parameters, path or query are held in the parameters array ( but might be a reference)

    const parameters =
      data.parameters == undefined
        ? []
        : parseParametersFromPathOrQueryString(json, data.parameters);

    const requestBody =
      data.requestBody == undefined
        ? {}
        : parseParametersFromRequest(json, data.requestBody);

    let secrets:
      | OpenAPIV3.SecuritySchemeObject
      | OpenAPIV3_1.SecuritySchemeObject
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3_1.ReferenceObject
      | undefined = undefined;
    // We can only support Bearer tokens for now.
    if (
      json.components != undefined &&
      json.components.securitySchemes != undefined
    ) {
      // Check to see if global security is defined, it's the same type and && it is a bearer token.
      const bearerSecurity = Object.entries(
        json.components.securitySchemes
      ).find(([securityMethodKey, securityValue]) => {
        if (isReferenceObject(securityValue)) {
          return false;
        }

        if (json.security == undefined) {
          return false;
        }

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
        secrets = bearerSecurity[1];
      }
    }

    return {
      operationId,
      url: baseUrl.replace(/\/$/, "") + path,
      method: method.toUpperCase(),
      description: data.description,
      summary: data.summary,
      parameters,
      requestBody,
      secrets,
    };
  });

  return outputApis;
};

export const importGraph = async (url: string, options: ImportOptions) => {
  if (URL.canParse(url) == false) {
    const fileStat = await stat(path.resolve(process.cwd(), url));
    if (fileStat != undefined && fileStat.isFile()) {
      // We think it's a file.
      url = pathToFileURL(url).toString();
    } else {
      throw new Error("Invalid URL");
    }
  }

  const apiPathFilter = options.api;
  const outputPath = options.output;

  if (apiPathFilter == undefined && outputPath == undefined) {
    console.error(
      "You must specify either -a (an API) or a directory to output all of the APIs to."
    );
    return;
  }

  let openAPIData = "";
  let json;

  try {
    if (url.startsWith("file://")) {
      openAPIData = await readFile(url.replace("file://", ""), {
        encoding: "utf-8",
      });
    } else {
      openAPIData = await (await fetch(url)).text();
    }
  } catch (e) {
    throw new Error(`Unable to fetch OpenAPI spec from ${url}`);
  }

  try {
    json = yaml.parse(openAPIData);
  } catch (yamlLoadError) {
    try {
      json = JSON.parse(openAPIData);
    } catch (jsonLoadError) {
      throw new Error(
        `Unable to parse OpenAPI spec from ${url}. It's not a valid JSON or YAML file.`
      );
    }
  }

  if (json == undefined) {
    throw new Error(`Unable to parse OpenAPI spec from ${url}`);
  }

  const openAPI = isOpenAPI(json);

  if (openAPI == false) {
    throw new Error("Not an Open API v3 or v3.1 spec.");
  }

  // Generate the API specs so that we can create a board from them.
  const apiSpecs = generateAPISpecs(json);

  for (const api of apiSpecs) {
    if (api == undefined) {
      continue;
    }

    if (apiPathFilter != undefined && apiPathFilter != api.operationId) {
      continue;
    }

    const board = new Board({
      title: api?.operationId,
      description: api?.description,
      version: "0.0.1",
    });

    if (api.parameters.length > 0) {
      // For each QS or Path parameter on the API, we need to add an input node to the board.
      const params: Record<string, NodeValue> = {};

      for (const param of api.parameters) {
        if (param.name == undefined) {
          continue;
        }
        params[param.name] = {
          title: param?.name,
          type: param?.schema.type,
          description: param?.description || `The data for ${param.name}`,
          example: param?.schema?.example,
        };

        board.addEdge({
          from: "path-inputs",
          to: "url",
          out: param?.name,
          in: param?.name,
        });
      }

      board.addNode({
        id: "path-inputs",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: params,
            required: api.parameters
              .filter((param) => param?.required)
              .map((param) => param?.name),
          },
        },
      });
    }

    board.addNode({
      id: "url",
      type: "urlTemplate",
      configuration: {
        template: `${api.url}?${api.parameters
          .map((param) => `${param?.name}={${param?.name}}`)
          .join("&")}`,
      },
    });

    board.addEdge({
      from: "url",
      to: "fetch",
      out: "url",
      in: "url",
    });

    if (api.secrets != undefined) {
      const apiKeyName = `${json.info.title
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toUpperCase()}_KEY`;

      board.addNode({
        id: "input-secrets",
        type: "secrets",
        configuration: {
          keys: [apiKeyName],
        },
      });

      board.addEdge({
        from: "input-secrets",
        to: "make-headers",
        out: apiKeyName,
        in: "Authorization_Key",
      });
    }

    const authorizationHeader = api.secrets
      ? {
          Authorization: `Bearer `,
        }
      : {};

    const contentTypeHeader = api.requestBody
      ? {
          "Content-Type": "application/json",
        }
      : {};

    board.addNode({
      id: "make-headers",
      type: "runJavascript",

      configuration: {
        raw: true,
        code: `function(inputs) {
          const headers = {};

          if (inputs.Authorization_Key != undefined) {
            headers["Authorization"] = "Bearer " + inputs.Authorization_Key;
          }

          if ("Content-Type" in inputs) {
            headers["Content-Type"] = inputs["Content-Type"];
          }
          
          return { headers };
      }`,
        ...contentTypeHeader,
        ...authorizationHeader,
      },
    });

    board.addEdge({
      from: "make-headers",
      to: "fetch",
      out: "headers",
      in: "headers",
    });

    if (Object.keys(api.requestBody).length > 0) {
      // Only support JSON Schema for now.  If you need XML, talk to Paul.
      board.addNode({
        id: "input-requestBody",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              requestBody: {
                type: "object",
                title: "requestBody",
                description: "The request body for the API call (JSON)",
              },
            },
          },
        },
      });

      board.addEdge({
        from: "input-requestBody",
        to: "fetch",
        out: "requestBody",
        in: "body",
      });
    }

    board.addNode({
      id: "fetch",
      type: "fetch",
      configuration: {
        method: api?.method,
        raw: true,
      },
    });

    board.addEdge({
      from: "fetch",
      to: "output",
      out: "response",
      in: "api_json_response",
    });

    board.addNode({
      id: "output",
      type: "output",
    });

    console.log(board);
    if (api.operationId != undefined && outputPath != undefined) {
      outputBoard(board, api.operationId, outputPath);
    }
  }
};

const outputBoard = async (
  board: unknown,
  apiPath: string,
  outputPath: string
) => {
  const boardJSON = JSON.stringify(board);
  const boardName = apiPath;
  const boardPath = path.join(
    path.resolve(process.cwd(), outputPath),
    `${boardName}.json`
  );
  writeFile(boardPath, boardJSON, { encoding: "utf-8" });
};
