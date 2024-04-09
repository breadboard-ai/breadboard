import type { AtLeastV3Document, AtLeastV3ReferenceObject } from "./types.js";

export function isReferenceObject(
  obj: object
): obj is AtLeastV3ReferenceObject {
  return "$ref" in obj;
}

export function isOpenAPI(json: object): json is AtLeastV3Document {
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
