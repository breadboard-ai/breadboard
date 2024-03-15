/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, NodeValue } from "@google-labs/breadboard";

import { stat, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { ImportOptions } from "./commandTypes.js";
import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { generateAPISpecs } from "./import/generateAPISpecs.js";
import { isOpenAPI } from "./import/gate.js";
import { loadOpenAPI } from "./import/loader.js";

export type ExcluedRequestBody = Exclude<
  OpenAPIV3_1.RequestBodyObject | OpenAPIV3.RequestBodyObject,
  OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
>;

export type ExcludedParameter = Exclude<
  OpenAPI.Parameter,
  OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
>;

export type MediaTypeObject =
  | OpenAPIV3_1.MediaTypeObject
  | OpenAPIV3.MediaTypeObject;

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

  const json = await loadOpenAPI(url);

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
