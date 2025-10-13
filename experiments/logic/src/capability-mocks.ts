/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CallToolRequest,
  CallToolResponse,
  Capabilities,
  CapabilityMocks,
  Console,
  GeminiInputs,
  GeminiMock,
  GeminiOutputs,
  Prompt,
  SchemaValidated,
} from "./types";

export class CapabilityMocksImpl implements CapabilityMocks {
  constructor(private readonly reporter: Console) {}

  #callback?: (args: GeminiInputs) => Promise<GeminiOutputs>;

  readonly capabilities: Capabilities = {
    generate: {
      generateContent: async (args: GeminiInputs): Promise<GeminiOutputs> => {
        if (!this.#callback) {
          throw new Error("Callback not set");
        }
        return this.#callback(args);
      },
    },
    mcp: {
      callTool: function (_params: CallToolRequest): Promise<CallToolResponse> {
        throw new Error("Function not implemented.");
      },
    },
    console: {
      error: (...params: unknown[]): void => {
        this.reporter.error(...params);
      },
      log: (...params: unknown[]): void => {
        this.reporter.log(...params);
      },
    },
    prompts: {
      get: function (
        _id: string,
        _values?: Record<string, SchemaValidated>
      ): Promise<Prompt> {
        throw new Error("Function not implemented.");
      },
    },
  };

  readonly generate: GeminiMock = {
    onGenerateContent: (callback) => {
      this.#callback = callback;
    },
  };
}
