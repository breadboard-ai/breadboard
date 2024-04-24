/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BehaviorSchema, Schema } from "@google-labs/breadboard";
import { validate } from "jsonschema";

const LLMSchema = {
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
                  mime_type: { type: "string" },
                },
                required: ["data", "mime_type"],
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
      return valueItems.type;
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

export function assertIsLLMContent(item: unknown) {
  if (typeof item !== "object" || item === null) {
    throw new Error("Not an object");
  }

  const result = validate(item, LLMSchema);
  if (result.valid) {
    return;
  }

  const msg = result.errors.reduce((prev, curr, idx) => {
    return (
      prev +
      (idx > 0 ? "\n" : "") +
      `${curr.path.join(".")} ${curr.message.split(",").join(", ")}`
    );
  }, "");

  throw new Error(msg);
}
