/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, Outcome } from "@breadboard-ai/types";

import { A2ModuleArgs } from "./runnable-module-factory";
import { McpClientManager } from "@breadboard-ai/mcp";
import {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./agent/function-definition";
import { FunctionCallerImpl } from "./agent/function-caller";
import { SimplifiedToolManager } from "./a2/tool-manager";
import { AgentFileSystem } from "./agent/file-system";
import { ok } from "@breadboard-ai/utils";

export { EvalHarness };

export type EvalHarnessArgs = {
  apiKey?: string;
  fileSystem: AgentFileSystem;
  logger: {
    request(url: string, init?: RequestInit): number;
    response(id: number, res: Response): Promise<void>;
  };
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

  readonly functionCallerFactory = {
    create: (
      builtIn: Map<string, FunctionDefinition>,
      custom: SimplifiedToolManager
    ) => {
      mock("generate_images_from_prompt", async () => {
        const image = this.args.fileSystem.add({
          text: "Mock Generated Image",
        });
        if (!ok(image)) return { error: image.$error };
        return { images: [image] };
      });
      return new FunctionCallerImpl(builtIn, custom);

      function mock(
        name: string,
        handler: (
          args: Record<string, unknown>,
          statusUpdateCallback: StatusUpdateCallback
        ) => Promise<Outcome<Record<string, unknown>>>
      ) {
        const def = builtIn.get(name);
        if (!def) return;
        const mocked: FunctionDefinition = { ...def, handler };
        builtIn.set(name, mocked);
      }
    },
  };

  readonly moduleArgs: A2ModuleArgs = {
    mcpClientManager: {} as unknown as McpClientManager,
    fetchWithCreds: async (url: RequestInfo | URL, init?: RequestInit) => {
      const entryId = this.args.logger.request(url as string, init);
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          "x-goog-api-key": this.args.apiKey!,
        },
      });
      this.args.logger.response(entryId, response.clone());
      return response;
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
