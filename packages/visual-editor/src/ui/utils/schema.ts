/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BehaviorSchema, Schema } from "@breadboard-ai/types";
import { Ajv, AnySchema, ValidateFunction } from "ajv";

const LLMContentSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "LLM Content Schema",
  type: "object",
  properties: {
    role: {
      type: "string",
    },
    parts: {
      type: "array",
      additionalProperties: false,
      items: {
        oneOf: [
          {
            $id: "text",
            properties: {
              text: {
                type: "string",
              },
            },
            additionalProperties: false,
          },
          {
            $id: "inlineData",
            properties: {
              inlineData: {
                properties: {
                  data: { type: "string" },
                  mimeType: { type: "string" },
                },
                required: ["data", "mimeType"],
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
          {
            $id: "functionCall",
            properties: {
              functionCall: {
                properties: {
                  name: { type: "string" },
                  args: { type: "object" },
                },
                required: ["name", "args"],
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
          {
            $id: "functionResponse",
            properties: {
              functionResponse: {
                properties: {
                  name: { type: "string" },
                  response: { type: "object" },
                },
                required: ["name", "response"],
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["parts"],
};

interface Items {
  type?: string;
  behavior: BehaviorSchema[];
}

export function resolveArrayType(value: Schema) {
  if (value.items) {
    const valueItems = value.items as Items;
    if (valueItems.type) {
      return valueItems.type ?? "string";
    }
  }

  return "string";
}

export function resolveBehaviorType(value: Schema | Schema[] | undefined) {
  if (!value || Array.isArray(value)) {
    return null;
  }

  if (value.behavior) {
    if (Array.isArray(value.behavior) && value.behavior.length > 0) {
      return value.behavior[0];
    } else {
      return value.behavior;
    }
  }

  return null;
}

export const validate = (item: unknown, schema: unknown) => {
  const validator = new Ajv({ strict: false });
  let validate: ValidateFunction;
  try {
    validate = validator.compile(schema as AnySchema);
  } catch (e) {
    return { valid: false, errors: (e as Error).message };
  }

  const valid = validate(item);

  if (!valid) {
    return { valid: false, errors: validator.errorsText(validate.errors) };
  }

  return { valid: validate(item) };
};

export function isLLMContent(item: unknown) {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  return validate(item, LLMContentSchema).valid;
}

export function assertIsLLMContent(item: unknown) {
  if (typeof item !== "object" || item === null) {
    throw new Error("Not an object");
  }

  const result = validate(item, LLMContentSchema);
  if (result.valid) {
    return;
  }

  throw new Error(result.errors);
}

export function assertIsLLMContentArray(item: unknown) {
  if (typeof item !== "object" || item === null || !Array.isArray(item)) {
    throw new Error("Not an array");
  }

  const isLLMContentArray = item.every((entry) => {
    return validate(entry, LLMContentSchema).valid;
  });

  if (isLLMContentArray) {
    return;
  }

  throw new Error("Not an LLM Content Array");
}
