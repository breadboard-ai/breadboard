/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, Outcome } from "@breadboard-ai/types";

import gemini, { GeminiAPIOutputs, GeminiInputs } from "./a2/gemini";
import { A2ModuleArgs } from "./runnable-module-factory";
import { McpClientManager } from "@breadboard-ai/mcp";

export { EvalHarness };

export type EvalHarnessArgs = {
  apiKey?: string;
};

/**
 * Given a GeminiInputs, runs it and returns GeminiAPIOutputs
 */
class EvalHarness {
  constructor(private readonly args: EvalHarnessArgs) {}
  async run(inputs: GeminiInputs): Promise<Outcome<GeminiAPIOutputs>> {
    if (!this.args.apiKey) {
      throw new Error(`Unable to run: no Gemini API Key supplied`);
    }

    const caps: Capabilities = {
      fetch() {
        throw new Error(`Not implemented`);
      },
      invoke() {
        throw new Error(`Not implemented`);
      },
      input() {
        throw new Error(`Not implemented`);
      },
      async output(data) {
        console.log(data.$metadata?.title);
        return { delivered: true };
      },
      describe() {
        throw new Error(`Not implemented`);
      },
      query() {
        throw new Error(`Not implemented`);
      },
      read() {
        throw new Error(`Not implemented`);
      },
      async write() {
        // Do nothing
      },
      blob() {
        throw new Error(`Not implemented`);
      },
    };
    const moduleArgs: A2ModuleArgs = {
      mcpClientManager: {} as unknown as McpClientManager,
      fetchWithCreds: async (url: RequestInfo | URL, init?: RequestInit) => {
        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            "x-goog-api-key": this.args.apiKey!,
          },
        });
      },
      context: {},
    };
    return gemini(inputs, caps, moduleArgs) as Promise<
      Outcome<GeminiAPIOutputs>
    >;
  }
}
