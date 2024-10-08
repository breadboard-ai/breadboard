/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object } from "@breadboard-ai/build";
import {
  type NodeValue,
  type InputValues,
  type OutputValues,
  type Schema,
} from "@google-labs/breadboard";
import Ajv from "ajv";

export type ValidateJsonInputs = InputValues & {
  /**
   * The string to validate as JSON.
   */
  json: string;
  /**
   * Optional schema to validate against.
   */
  schema?: NodeValue;
  /**
   * Optional boolean to enforce or turn off strict validation of the supplied schema.
   */
  strictSchema?: boolean;
};

export type ValidationErrorType = "parsing" | "schema" | "validation";

export type InvalidJsonOutputs = OutputValues & {
  /**
   * The error if the JSON is invalid.
   */
  $error: {
    kind: "error";
    error: {
      /**
       * The type of error.
       */
      type: ValidationErrorType;
      /**
       * The message of the error.
       */
      message: string;
    };
  };
};

export type ValidatedJsonOutputs = OutputValues & {
  /**
   * The validated JSON.
   */
  json: NodeValue;
};

export type ValidateJsonOutputs = InvalidJsonOutputs | ValidatedJsonOutputs;

export const stripCodeBlock = (code: string) =>
  code.replace(/(?:.*)(?:```(?:json)?\n+)(.*)(?:\n+```)(?:.*)/gms, "$1");

export const tryParseJson = (json: string): InvalidJsonOutputs | NodeValue => {
  try {
    return JSON.parse(stripCodeBlock(json));
  } catch (e) {
    const error = e as Error;
    return {
      $error: {
        kind: "error",
        error: { type: "parsing", message: error.message },
      },
    };
  }
};

export const validateJson = (
  parsed: NodeValue,
  schema: Schema,
  strictSchema: boolean | undefined = undefined
): ValidateJsonOutputs => {
  const result = { json: parsed };
  if (!schema) return result;
  const validator = new Ajv.default({ strict: strictSchema });
  let validate: Ajv.ValidateFunction;
  try {
    validate = validator.compile(schema);
  } catch (e) {
    return {
      $error: {
        kind: "error",
        error: {
          type: "schema",
          message: (e as Error).message,
        },
      },
    };
  }

  const valid = validate(parsed);
  if (!valid) {
    return {
      $error: {
        kind: "error",
        error: {
          type: "validation",
          message: validator.errorsText(validate.errors),
        },
      },
    };
  }

  return result;
};

const invoke = async (inputs: InputValues): Promise<OutputValues> => {
  const { json, schema, strictSchema } = inputs as ValidateJsonInputs;
  if (!json) throw new Error("The `json` input is required.");

  if (!schema && strictSchema == true) {
    throw new Error(
      "The `schema` input is required when `strictSchema` is true."
    );
  }

  // First, let's try to parse JSON.
  const parsed = tryParseJson(json);
  const possiblyInvalid = parsed as InvalidJsonOutputs;
  if (possiblyInvalid?.$error) return possiblyInvalid;

  // Then, let's make sure we have schema in the right format.
  let parsedSchema = schema;
  if (schema && typeof schema === "string") {
    try {
      parsedSchema = tryParseJson(schema);
    } catch (e) {
      throw new Error("The `schema` input is not valid JSON.");
    }
  }

  // Now, let's try to validate JSON.
  return validateJson(parsed, parsedSchema as Schema, strictSchema);
};

export default defineNodeType({
  name: "validateJson",
  metadata: {
    title: "Validate JSON",
    description:
      "Validates given text as JSON, trying its best to parse it first.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/json/#validatejson",
    },
  },
  inputs: {
    json: {
      title: "JSON string",
      description: "The string to validate as JSON.",
      type: "string",
    },
    schema: {
      title: "Schema",
      description: "Optional schema to validate against.",
      type: object({}, "unknown"),
      behavior: ["config"],
      optional: true,
    },
    strictSchema: {
      title: "Strict",
      description:
        "Optional boolean to enforce or turn off strict validation of the supplied schema.",
      type: "boolean",
      behavior: ["config"],
      default: false,
    },
  },
  outputs: {
    json: {
      title: "JSON",
      description: "The validated JSON.",
      type: "unknown",
    },
  },
  invoke,
});
