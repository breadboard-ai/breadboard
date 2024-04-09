import { OpenAPI } from "openapi-types";
import type {
  AtLeastV3ReferenceObject,
  AtLeastV3RequestBodyObject,
  ExcludedParameter,
  ExcludeRequestBody,
  MediaTypeObject,
  SupportedOpenAPIDocuments,
} from "./types.js";
import { isReferenceObject } from "./gates.js";

export function parseParametersFromRequest<
  D extends SupportedOpenAPIDocuments,
  P extends AtLeastV3ReferenceObject | AtLeastV3RequestBodyObject,
>(json: D, request: P): ExcludeRequestBody["content"] {
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

  const accumulator: ExcludeRequestBody["content"] = {};
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

export function parseParametersFromPathOrQueryString<
  D extends SupportedOpenAPIDocuments,
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
