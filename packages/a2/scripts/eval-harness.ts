/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types";

import { A2ModuleArgs } from "../src/runnable-module-factory";
import { McpClientManager } from "@breadboard-ai/mcp";
import { Logger } from "./logger";
import { Har } from "har-format";
import { mock } from "node:test";
import type { callGeminiImage } from "../src/a2/image-utils";
import { autoClearingInterval } from "./auto-clearing-interval";

export { EvalHarness };

export type EvalHarnessRuntimeArgs = {
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
};

export type EvalHarnessFunction = (
  args: EvalHarnessRuntimeArgs
) => Promise<void>;

export type EvalHarnessArgs = {
  /**
   * The name of the eval. Will be used to name the output
   * file.
   */
  name: string;
  apiKey?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

function mockFunction<T extends AnyFunction>(
  moduleSpecifier: string,
  functionName: string,
  implementation?: T
) {
  const resolvedPath = import.meta.resolve(moduleSpecifier);
  const mocked = mock.fn(implementation);

  mock.module(resolvedPath, { namedExports: { [functionName]: mocked } });

  return mocked;
}

/**
 * Given a GeminiInputs, runs it and returns GeminiAPIOutputs
 */
class EvalHarness {
  readonly logger = new Logger();

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
      const entryId = this.logger.request(url as string, init);
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          "x-goog-api-key": this.args.apiKey!,
        },
      });
      this.logger.response(entryId, response.clone());
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

  async eval(evalFunction: EvalHarnessFunction): Promise<Har> {
    // @ts-expect-error "Can't define window? Haha"
    globalThis.window = { location: new URL("https://example.com/") } as Window;

    mock.method(globalThis, "setInterval", autoClearingInterval.setInterval);

    mockFunction<typeof callGeminiImage>(
      "../src/a2/image-utils",
      "callGeminiImage",
      async () => {
        return [
          {
            parts: [
              {
                storedData: {
                  handle: "https://example.com/fakeurl",
                  mimeType: "image/png",
                },
              },
            ],
          },
        ];
      }
    );

    await evalFunction(this);
    const har = this.logger.getHar();
    mock.restoreAll();
    autoClearingInterval.clearAllIntervals();

    return har;
  }
}
