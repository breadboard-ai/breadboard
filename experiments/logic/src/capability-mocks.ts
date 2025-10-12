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
  GeminiInputs,
  GeminiMock,
  GeminiOutputs,
  Prompt,
  SchemaValidated,
} from "./types";

export class CapabilityMocksImpl implements CapabilityMocks {
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
      error: function (...params: unknown[]): void {
        console.error("From Invoke", ...params);
      },
      log: function (...params: unknown[]): void {
        console.log("From Invoke", ...params);
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
