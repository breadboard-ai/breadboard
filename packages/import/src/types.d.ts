import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

// We only support OpenAPI v3 and v3.1, the types here just make it cleaner in the other parsing logic.

export type AtLeastV3Document = OpenAPIV3.Document | OpenAPIV3_1.Document;

export type SupportedOpenAPIDocuments = OpenAPI.Document<AtLeastV3Document>;

export type AtLeastV3ReferenceObject =
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3_1.ReferenceObject;

export type AtLeastV3SecuritySchemeObject =
  | OpenAPIV3.SecuritySchemeObject
  | OpenAPIV3_1.SecuritySchemeObject;

export type AtLeastV3MediaObjectMap =
  | { [media: string]: OpenAPIV3.MediaTypeObject }
  | { [media: string]: OpenAPIV3_1.MediaTypeObject };

export type AtLeastV3RequestBodyObject =
  | OpenAPIV3.RequestBodyObject
  | OpenAPIV3_1.RequestBodyObject;

export type AtLeastV3Operation =
  | OpenAPIV3.OperationObject
  | OpenAPIV3_1.OperationObject;

export type APISpec = {
  operationId: string;
  url: string;
  method: string;
  description: string;
  summary: string;
  parameters: ExcludedParameter[];
  requestBody: AtLeastV3MediaObjectMap;
  secrets: AtLeastV3SecuritySchemeObject | AtLeastV3ReferenceObject | undefined;
};

export type ExcludeRequestBody = Exclude<
  AtLeastV3RequestBodyObject,
  AtLeastV3ReferenceObject
>;

export type ExcludedParameter = Exclude<
  OpenAPI.Parameter,
  AtLeastV3ReferenceObject
>;

export type MediaTypeObject =
  | OpenAPIV3_1.MediaTypeObject
  | OpenAPIV3.MediaTypeObject;
