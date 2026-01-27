/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types";
import { mkdir, writeFile } from "fs/promises";
import { mock } from "node:test";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { callGeminiImage } from "../src/a2/a2/image-utils.js";
import { A2ModuleArgs } from "../src/a2/runnable-module-factory.js";
import { McpClientManager } from "../src/mcp/index.js";
import { autoClearingInterval } from "./auto-clearing-interval.js";
import { collateContexts } from "./collate-context.js";
import { Logger } from "./logger.js";
import {
  CheckAppAccessResult,
  FindUserOpalFolderResult,
  GuestConfiguration,
  ListUserOpalsResult,
  OpalShellHostProtocol,
  PickDriveFilesResult,
  SignInResult,
  SignInState,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { getDriveCollectorFile } from "../src/ui/utils/google-drive-host-operations.js";
import { getAuthenticatedClient } from "./authenticate.js";
import { type ConsentController } from "../src/sca/controller/subcontrollers/consent-controller.js";

export { session };

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT_DIR, "out");

export type EvalHarnessRuntimeArgs = {
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
  logger: EvalLogger;
};

export type EvalHarnessSession = {
  eval(evalName: string, fn: EvalHarnessFunction): Promise<void>;
  evalOnly(evalName: string, fn: EvalHarnessFunction): Promise<void>;
};

export type EvalHarnessSessionFunction = (
  session: EvalHarnessSession
) => Promise<void>;

export type EvalHarnessFunction = (
  args: EvalHarnessRuntimeArgs
) => Promise<unknown>;

export type EvalHarnessArgs = {
  /**
   * The name of the eval. Will be used to name the output
   * file.
   */
  name: string;
};

export type EvalLogger = {
  log(entry: EvalLogEntry): void;
};

export type EvalLogEntry = { type: string; data: unknown };

function session(
  args: EvalHarnessArgs,
  sessionFunction: EvalHarnessSessionFunction
) {
  const harness = new EvalHarness(args);
  return harness.session(sessionFunction);
}

/**
 * Given a GeminiInputs, runs it and returns GeminiAPIOutputs
 */
class EvalHarness {
  constructor(private readonly args: EvalHarnessArgs) {}

  async session(sessionFunction: EvalHarnessSessionFunction) {
    const client = await getAuthenticatedClient();
    const accessToken = (await client.getAccessToken()).token;
    if (!accessToken) {
      throw new Error("Unable to obtain access token");
    }

    // @ts-expect-error "Can't define window? Haha"
    globalThis.window = {
      location: new URL("https://example.com/"),
    } as Window;

    mock.method(globalThis, "setInterval", autoClearingInterval.setInterval);

    mockFunction<typeof callGeminiImage>(
      "../src/a2/a2/image-utils.js",
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

    const runEvalFn = async (
      evalName: string,
      evalFunction: EvalHarnessFunction
    ): Promise<void> => {
      const logEntries: EvalLogEntry[] = [];

      const run = new EvalRun(accessToken, evalName, {
        log: (entry) => logEntries.push(entry),
      });
      const outcome = await evalFunction(run);
      const har = run.requestLogger.getHar();
      await ensureDir(OUT_DIR);
      const filename = `${toKebabFilename(this.args.name)}-${toKebabFilename(evalName)}-${timestamp()}`;
      const harFilename = `${filename}.har`;
      const logFilename = `${filename}.log.json`;
      await writeFile(
        join(OUT_DIR, `${harFilename}`),
        JSON.stringify(har, null, 2),
        "utf-8"
      );
      const log = collateContexts(har);
      const outcomeEntry: unknown[] = outcome
        ? [{ type: "outcome", outcome }]
        : [];
      await writeFile(
        join(OUT_DIR, `${logFilename}`),
        JSON.stringify([...log, ...logEntries, ...outcomeEntry], null, 2),
        "utf-8"
      );

      const stats = log.map((entry) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { context, startedDateTime, type, config, ...entryStats } = entry;
        entryStats.totalDurationMs = entryStats.totalDurationMs | 0;
        entryStats.totalRequestTimeMs = entryStats.totalRequestTimeMs | 0;
        return entryStats;
      });
      console.log(`\n\n${evalName}`);
      console.table(stats);
      console.log(`HAR: "${harFilename}"`);
      console.log(`Log: "${logFilename}"`);
    };

    // Create a pool for evals and evalOnly callbacks.
    const evalTargets = {
      eval: new Map<string, EvalHarnessFunction>(),
      evalOnly: new Map<string, EvalHarnessFunction>(),
    };

    // Populate them via the session functions.
    const sessionEvalFn = async (
      target: "eval" | "evalOnly",
      evalName: string,
      evalFunction: EvalHarnessFunction
    ): Promise<void> => {
      evalTargets[target].set(evalName, evalFunction);
    };

    await sessionFunction({
      evalOnly: sessionEvalFn.bind(null, "evalOnly"),
      eval: sessionEvalFn.bind(null, "eval"),
    });

    // Now check if there are any in the evalOnly Map. If so, use those,
    // otherwise fall back to the default eval Map. Then run each and return.
    const runEvalTargets =
      evalTargets.evalOnly.size > 0
        ? [...evalTargets.evalOnly]
        : [...evalTargets.eval];
    if (evalTargets.evalOnly.size > 0) {
      console.warn(`Exclusive evaluations: ${evalTargets.evalOnly.size}`);
    }

    await Promise.all(runEvalTargets.map(([name, fn]) => runEvalFn(name, fn)));

    mock.restoreAll();
    autoClearingInterval.clearAllIntervals();
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

function toKebabFilename(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

class EvalRun implements EvalHarnessRuntimeArgs {
  constructor(
    private readonly accessToken: string,
    private readonly title: string,
    public readonly logger: EvalLogger
  ) {}

  readonly requestLogger = new Logger();

  readonly caps: Capabilities = {
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
  };

  private fetchWithCreds = async (
    url: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const entryId = this.requestLogger.request(url as string, init);
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    this.requestLogger.response(entryId, response.clone());
    return response;
  };

  readonly moduleArgs: A2ModuleArgs = {
    mcpClientManager: {} as unknown as McpClientManager,
    fetchWithCreds: this.fetchWithCreds,
    getConsentController() {
      return {
        async queryConsent() {
          return true;
        },
      } as Partial<ConsentController> as ConsentController;
    },

    context: {
      currentGraph: {
        title: this.title,
        url: encodeURIComponent(this.title),
        edges: [],
        nodes: [],
      },
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
            consentRequests: [],
          },
        };
      },
    },
    shell: {
      getDriveCollectorFile: (mimeType, connectorId, graphId) => {
        return getDriveCollectorFile({
          mimeType,
          connectorId,
          graphId,
          fetchWithCreds: this.fetchWithCreds,
        });
      },
      getSignInState: function (): Promise<SignInState> {
        throw new Error("Function not implemented.");
      },
      validateScopes: function (): Promise<ValidateScopesResult> {
        throw new Error("Function not implemented.");
      },
      getConfiguration: function (): Promise<GuestConfiguration> {
        throw new Error("Function not implemented.");
      },
      fetchWithCreds: globalThis.fetch,
      signIn: function (): Promise<SignInResult> {
        throw new Error("Function not implemented.");
      },
      signOut: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      setUrl: function (): void {
        throw new Error("Function not implemented.");
      },
      pickDriveFiles: function (): Promise<PickDriveFilesResult> {
        throw new Error("Function not implemented.");
      },
      shareDriveFiles: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      findUserOpalFolder: function (): Promise<FindUserOpalFolderResult> {
        throw new Error("Function not implemented.");
      },
      listUserOpals: function (): Promise<ListUserOpalsResult> {
        throw new Error("Function not implemented.");
      },
      checkAppAccess: function (): Promise<CheckAppAccessResult> {
        throw new Error("Function not implemented.");
      },
      sendToEmbedder: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      trackAction: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      trackProperties: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
    } satisfies OpalShellHostProtocol,
  };
}
