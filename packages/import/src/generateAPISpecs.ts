import { isReferenceObject } from "./gates.js";
import {
  parseParametersFromRequest,
  parseParametersFromPathOrQueryString,
} from "./parseParameters.js";
import type {
  APISpec,
  AtLeastV3Document,
  AtLeastV3Operation,
  AtLeastV3ReferenceObject,
  AtLeastV3SecuritySchemeObject,
} from "./types.js";

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

export const generateAPISpecs = (json: AtLeastV3Document): APISpec[] => {
  const { paths } = json;

  const baseUrl = json.servers?.[0].url;

  if (baseUrl == undefined) {
    throw new Error("No base URL in Open API spec.");
  }

  const apis: [string, string, AtLeastV3Operation][] = [];
  // Generate a list of APIs
  for (const apiPath in paths) {
    const pathInfo = paths[apiPath];
    if (pathInfo == undefined) {
      continue;
    }
    const globalPathParams = pathInfo.parameters || [];

    if (pathInfo.get != undefined) {
      pathInfo.get.parameters = pathInfo.get.parameters || [];
      pathInfo.get.parameters.push(...globalPathParams);
      apis.push([apiPath, "get", pathInfo.get]);
    }
    if (pathInfo.post != undefined) {
      pathInfo.post.parameters = pathInfo.post.parameters || [];
      pathInfo.post.parameters.push(...globalPathParams);
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
      | AtLeastV3SecuritySchemeObject
      | AtLeastV3ReferenceObject
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
      description: data.description || "",
      summary: data.summary || "",
      parameters,
      requestBody,
      secrets,
    };
  });

  return outputApis as APISpec[];
};
