/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GeminiRequest {
  contents: GeminiContent[];
  tools?: Array<{
    functionDeclarations: GeminiFunctionDeclaration[];
  }>;
  toolConfig?: {
    functionCallingConfig?: {
      mode: "auto" | "any" | "none";
      allowedFunctionNames?: string[];
    };
  };
  systemInstruction?: GeminiContent;
}

export interface GeminiContent {
  role?: "user" | "model";
  parts: GeminiPart[];
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCall
  | GeminiFunctionResponse;

export interface GeminiTextPart {
  text: string;
}

export interface GeminiFunctionCall {
  functionCall: {
    name: string;
    args: unknown;
  };
}

export interface GeminiFunctionResponse {
  functionResponse: {
    name: string;
    response: unknown;
  };
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
}

export interface GeminiCandidate {
  finishReason?: string;
  content?: GeminiContent;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiParameterSchema;
}

export type GeminiParameterSchema = {
  type?: "string" | "number" | "boolean" | "array" | "object";
  // TODO(aomarks) nullable is not standard JSON Schema, right? Usually
  // "required" is how you express that.
  nullable?: boolean;
  description?: string;
  properties?: Record<string, GeminiParameterSchema>;
  required?: string[];
  format?: string;
  enum?: string[];
  items?: GeminiParameterSchema;
  minItems?: number;
  maxItems?: number;
};
