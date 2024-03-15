import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { isReferenceObject } from "./gate.js";
import { inferOperationId } from "./inferOperationId.js";
import { parseParametersFromPathOrQueryString } from "./parseParametersFromPathOrQueryString.js";
import { parseParametersFromRequest } from "./parseParametersFromRequest.js";

export const generateAPISpecs = (
  json: OpenAPIV3.Document | OpenAPIV3_1.Document
) => {
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
