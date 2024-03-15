import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export function isReferenceObject(
  obj: object //OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
): obj is OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject {
  return "$ref" in obj;
}

export function isOpenAPI(
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
