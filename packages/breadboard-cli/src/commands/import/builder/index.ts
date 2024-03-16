import { Board, NodeValue } from "@google-labs/breadboard";
import { loadOpenAPI } from "./loader.js";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { isOpenAPI } from "./gates.js";
import { generateAPISpecs } from "./generateAPISpecs.js";
import { APISpec, ExcludedParameter } from "./types.js";

export class OpenAPIBoardBuilder {
  #url: string;
  #board: Board | undefined;
  #json: OpenAPIV3_1.Document<{}> | OpenAPIV3.Document<{}> | undefined;
  constructor(url: string) {
    this.#url = url;
  }

  private async load() {
    const url = this.#url;
    const json = await loadOpenAPI(url);
    if (json == undefined) {
      throw new Error(`Unable to parse OpenAPI spec from ${url}`);
    }

    const openAPI = isOpenAPI(json);

    if (openAPI == false) {
      throw new Error("Not an Open API v3 or v3.1 spec.");
    }

    this.#json = json;
  }

  public async *build(): AsyncGenerator<{ board: Board; apiSpec: APISpec }> {
    await this.load();
    if (this.#json == undefined) {
      throw new Error("Unable to load OpenAPI spec.");
    }
    const apiSpecs = generateAPISpecs(this.#json);
    const json = this.#json;
    for (const apiSpec of apiSpecs) {
      if (apiSpec == undefined) {
        throw new Error("Unable to generate API specs.");
      }
      const board = new Board({
        title: apiSpec?.operationId,
        description: apiSpec?.description,
        version: "0.0.1",
      });

      buildURL(board, apiSpec);

      buildSecrets(apiSpec, json, board);

      buildHTTPHeaders(apiSpec, board);

      board.addNode({
        id: "fetch",
        type: "fetch",
        configuration: {
          method: apiSpec?.method,
          raw: true,
        },
      });

      buildRequestBody(apiSpec, board);

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

      yield { board, apiSpec };
    }
  }
}

function buildRequestBody(
  api: {
    operationId: string;
    url: string;
    method: string;
    description: string | undefined;
    summary: string | undefined;
    parameters: ExcludedParameter[];
    requestBody:
      | { [media: string]: OpenAPIV3.MediaTypeObject }
      | { [media: string]: OpenAPIV3_1.MediaTypeObject };
    secrets:
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.SecuritySchemeObject
      | undefined;
  },
  board: Board
) {
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
}

function buildSecrets(
  api: {
    operationId: string;
    url: string;
    method: string;
    description: string | undefined;
    summary: string | undefined;
    parameters: ExcludedParameter[];
    requestBody:
      | { [media: string]: OpenAPIV3.MediaTypeObject }
      | { [media: string]: OpenAPIV3_1.MediaTypeObject };
    secrets:
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.SecuritySchemeObject
      | undefined;
  },
  json: OpenAPIV3.Document<{}> | OpenAPIV3_1.Document<{}>,
  board: Board
) {
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
      to: "mergeHTTPHeaders",
      out: apiKeyName,
      in: "Authorization_Key",
    });
  }
}

/*
  Creates the URL node and the path-inputs node for the board.

  The URL is a combination of the URL from the API and the parameters from the API.
*/
function buildURL(
  board: Board,
  api: {
    operationId: string;
    url: string;
    method: string;
    description: string | undefined;
    summary: string | undefined;
    parameters: ExcludedParameter[];
    requestBody:
      | { [media: string]: OpenAPIV3.MediaTypeObject }
      | { [media: string]: OpenAPIV3_1.MediaTypeObject };
    secrets:
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.SecuritySchemeObject
      | undefined;
  }
) {
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
}

function buildHTTPHeaders(
  api: {
    operationId: string;
    url: string;
    method: string;
    description: string | undefined;
    summary: string | undefined;
    parameters: ExcludedParameter[];
    requestBody:
      | { [media: string]: OpenAPIV3.MediaTypeObject }
      | { [media: string]: OpenAPIV3_1.MediaTypeObject };
    secrets:
      | OpenAPIV3.ReferenceObject
      | OpenAPIV3_1.ReferenceObject
      | OpenAPIV3.SecuritySchemeObject
      | undefined;
  },
  board: Board
) {
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
    id: "mergeHTTPHeaders",
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
    from: "mergeHTTPHeaders",
    to: "fetch",
    out: "headers",
    in: "headers",
  });
}
