import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { ExcluedRequestBody, MediaTypeObject } from "../import.js";
import { isReferenceObject } from "./gate.js";

export function parseParametersFromRequest<
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
