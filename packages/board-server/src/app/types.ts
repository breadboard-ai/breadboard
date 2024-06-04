/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type LLMInlineData = {
  inlineData: { data: string; mimeType: string };
};

export type LLMFunctionCall = {
  functionCall: {
    name: string;
    args: object;
  };
};

export type LLMFunctionResponse = {
  functionResponse: {
    name: string;
    response: object;
  };
};

export type LLMText = {
  text: string;
};

export type LLMStoredData = {
  storedData: {
    handle: string;
    mimeType: string;
  };
};

export type LLMPart =
  | LLMInlineData
  | LLMStoredData
  | LLMFunctionCall
  | LLMFunctionResponse
  | LLMText;

export type LLMContent = {
  role?: string;
  parts: LLMPart[];
};
