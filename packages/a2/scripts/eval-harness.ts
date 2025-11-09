/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types";

import { A2ModuleArgs } from "../src/runnable-module-factory";
import { McpClientManager } from "@breadboard-ai/mcp";
import { Logger } from "./logger";
import { mock } from "node:test";
import type { callGeminiImage } from "../src/a2/image-utils";
import { autoClearingInterval } from "./auto-clearing-interval";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdir, writeFile } from "fs/promises";

export { EvalHarness };

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const OUT_DIR = join(ROOT_DIR, "out");

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

  async eval(evalFunction: EvalHarnessFunction): Promise<void> {
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
    await ensureDir(OUT_DIR);
    await writeFile(
      join(OUT_DIR, `${this.args.name}-${timestamp()}.har`),
      JSON.stringify(har, null, 2),
      "utf-8"
    );
  }
}

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

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function timestamp(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}
