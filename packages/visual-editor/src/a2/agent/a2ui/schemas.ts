/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

/**
 * Please keep these synchronized with
 * packages/a2ui/src/[current version]/schemas/
 *
 * Use https://transform.tools/json-schema-to-zod for conversion.
 */

export const A2UIClientEventParameters = {
  userAction: z
    .object({
      name: z
        .string()
        .describe(
          "The name of the action, taken from the component's action.name property."
        ),
      surfaceId: z
        .string()
        .describe("The id of the surface where the event originated."),
      sourceComponentId: z
        .string()
        .describe("The id of the component that triggered the event."),
      timestamp: z
        .string()
        .describe("An ISO 8601 timestamp of when the event occurred."),
      context: z
        .object({})
        .catchall(z.any())
        .describe(
          "A JSON object containing the key-value pairs from the component's action.context, after resolving all data bindings."
        ),
    })
    .describe("Reports a user-initiated action from a component.")
    .optional(),
  error: z
    .object({})
    .catchall(z.any())
    .describe("Reports a client-side error. The content is flexible.")
    .optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const A2UIClientEventMessageZodType = z.object(A2UIClientEventParameters);

export type A2UIClientEventMessage = z.infer<
  typeof A2UIClientEventMessageZodType
>;
