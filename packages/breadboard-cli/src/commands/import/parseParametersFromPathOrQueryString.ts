import { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { ExcludedParameter } from "../import.js";
import { isReferenceObject } from "./gate.js";

export function parseParametersFromPathOrQueryString<
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
