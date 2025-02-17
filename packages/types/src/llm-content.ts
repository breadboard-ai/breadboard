/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type FunctionCallCapabilityPart = {
  functionCall: {
    name: string;
    args: object;
  };
};

export type FunctionResponseCapabilityPart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

export type TextCapabilityPart = {
  text: string;
};

export type DataStoreHandle = string;

/**
 * Represents data that is stored by a DataStoreProvider.
 */
export type StoredDataCapabilityPart = {
  storedData: {
    handle: DataStoreHandle;
    mimeType: string;
  };
};

export type FileDataPart = {
  fileData: {
    /**
     * Can be either a URL pointing to a YT video or a URL pointing at a
     * resource saved with File API.
     */
    fileUri: string;
    mimeType: string;
  };
};

export type ExecutableCodePart = {
  executableCode: {
    language: "LANGUAGE_UNSPECIDIED" | "PYTHON";
    code: string;
  };
};

export type CodeExecutionResultOutcome =
  // 	Unspecified status. This value should not be used.
  | "OUTCOME_UNSPECIFIED"
  // Code execution completed successfully.
  | "OUTCOME_OK"
  // Code execution finished but with a failure. stderr should contain the reason.
  | "OUTCOME_FAILED"
  // Code execution ran for too long, and was cancelled. There may or may not be a partial output present.
  | "OUTCOME_DEADLINE_EXCEEDED";

export type CodeExecutionResultPart = {
  codeExecutionResult: {
    outcome: CodeExecutionResultOutcome;
    output: string;
  };
};

export type DataPart =
  | InlineDataCapabilityPart
  | StoredDataCapabilityPart
  | FileDataPart
  | ExecutableCodePart
  | CodeExecutionResultPart
  | FunctionCallCapabilityPart
  | FunctionResponseCapabilityPart
  | TextCapabilityPart;

export type LLMContent = {
  role?: string;
  parts: DataPart[];
};

/**
 * Represents inline data, encoded as a base64 string.
 */
export type InlineDataCapabilityPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};
