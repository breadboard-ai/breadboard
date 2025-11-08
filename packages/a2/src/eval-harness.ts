/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types";

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
  readonly caps: Capabilities = {
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

  readonly moduleArgs: A2ModuleArgs = {
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
    context: {
      currentStep: {
        id: "current-step",
        type: "mock",
      },
      getProjectRunState: () => {
        return {
          console: new Map([
            [
              "current-step",
              {
                title: "Current Step",
                open: true,
                rerun: false,
                work: new Map(),
                output: new Map(),
                error: null,
                completed: false,
                current: null,
              },
            ],
          ]),
          app: {
            state: "splash",
            screens: new Map([
              [
                "current-step",
                {
                  title: "Current Step",
                  progress: undefined,
                  expectedDuration: -1,
                  progressCompletion: -1,
                  status: "interactive",
                  type: "progress",
                  outputs: new Map(),
                  last: null,
                },
              ],
            ]),
            current: new Map(),
            last: null,
          },
        };
      },
    },
  };

  constructor(private readonly args: EvalHarnessArgs) {
    if (!args.apiKey) {
      throw new Error(`Unable to run: no Gemini API Key supplied`);
    }
  }
}
