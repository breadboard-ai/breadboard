/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineFunctionLoose } from "../function-definition";
import { SurfaceSpec } from "./generate-spec";
import { A2UIRenderer } from "../types";

export { makeFunction };

function makeFunction(
  spec: SurfaceSpec,
  template: unknown[], // TODO: Use proper types here
  renderer: A2UIRenderer
) {
  const { surfaceId, description, dataModelSchema, responseSchema } = spec;
  const name = `ui_ask_user_${surfaceId}`;
  const parametersJsonSchema = dataModelSchema;
  const responseJsonSchema = responseSchema;
  return defineFunctionLoose(
    {
      name,
      description,
      parametersJsonSchema,
      responseJsonSchema,
    },
    async (contents) => {
      const modelUpdate = {
        dataModelUpdate: { surfaceId, path: "/", contents },
      };
      const payload = [...template, modelUpdate];
      return renderer.render(payload);
    }
  );
}
