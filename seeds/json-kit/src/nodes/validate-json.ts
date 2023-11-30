/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";
import { Schema, Validator } from "jsonschema";

export type ValidateJsonInputs = InputValues & {
  /**
   * The string to validate as JSON.
   */
  json: string;
  /**
   * Optional schema to validate against.
   */
  schema?: NodeValue;
};

export type ValidationErrorType = "parsing" | "validation";

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
  code.replace(/(?:```(?:json)?\n+)(.*)(?:\n+```)/gms, "$1");

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
  schema: Schema
): ValidateJsonOutputs => {
  const result = { json: parsed };
  if (!schema) return result;
  const validator = new Validator();
  const validationResult = validator.validate(parsed, schema as Schema, {
    nestedErrors: true,
  });
  if (!validationResult.valid) {
    return {
      $error: {
        kind: "error",
        error: {
          type: "validation",
          message: validationResult.toString(),
        },
      },
    };
  }
  return result;
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { json, schema } = inputs as ValidateJsonInputs;
  if (!json) throw new Error("The `json` input is required.");

  // First, let's try to parse JSON.
  const parsed = tryParseJson(json);
  const possiblyInvalid = parsed as InvalidJsonOutputs;
  if (possiblyInvalid?.error) return possiblyInvalid;

  // Now, let's try to validate JSON.
  return validateJson(parsed, schema as Schema);
};
