import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export type AtLeastV3 = OpenAPIV3.Document | OpenAPIV3_1.Document;

export type SupportedOpenAPIDocuments = OpenAPI.Document<AtLeastV3>;

export type AtLeastV3ReferenceObject =
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3_1.ReferenceObject;

export type APISpec = {
  operationId: string;
  url: string;
  method: string;
  description: string;
  summary: string;
  parameters: ExcludedParameter[];
  requestBody:
    | {
        [media: string]: OpenAPIV3.MediaTypeObject;
      }
    | {
        [media: string]: OpenAPIV3_1.MediaTypeObject;
      };
  secrets:
    | OpenAPIV3.SecuritySchemeObject
    | OpenAPIV3_1.SecuritySchemeObject
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3_1.ReferenceObject
    | undefined;
};

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
