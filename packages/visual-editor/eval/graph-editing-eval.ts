/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile, readFile, stat } from "fs/promises";
import { mock } from "node:test";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { A2ModuleArgs } from "../src/a2/runnable-module-factory.js";
import { buildHooksFromSink } from "../src/a2/agent/loop-setup.js";
import { AgentContext } from "../src/a2/agent/agent-context.js";
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
import { HttpBackendClient } from "../src/ui/utils/http-backend-client.js";
import { getAuthenticatedClient } from "./authenticate.js";
import { type ConsentController } from "../src/sca/controller/subcontrollers/global/global.js";
import { AgentService } from "../src/a2/agent/agent-service.js";
import { invokeGraphEditingAgent } from "../src/a2/agent/graph-editing/main.js";
import { EditingAgentPidginTranslator } from "../src/a2/agent/graph-editing/editing-agent-pidgin-translator.js";
import { AgentEventConsumer, LocalAgentEventBridge } from "../src/a2/agent/agent-event-consumer.js";
import { ok } from "@breadboard-ai/utils";
import { generateContent, GeminiBody, GeminiSchema } from "../src/a2/a2/gemini.js";
import { toLLMContent } from "../src/a2/a2/utils.js";
import { A2_TOOLS } from "../src/a2/a2-registry.js";
import { HeadlessGraphEditor } from "./headless-graph-editor.js";
import { GraphEditingManager } from "../src/a2/agent/graph-editing/graph-editing-manager.js";
import { LLMContent, GraphDescriptor } from "@breadboard-ai/types";

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { GOOGLE_DRIVE_FOLDER_MIME_TYPE, GRAPH_MIME_TYPE } from "../src/ui/utils/google-drive-host-operations.js";
export { graphEditingSession };

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT_DIR, "out");

type TranscriptEvent =
  | { type: "objective"; text: string }
  | { type: "thought"; text: string }
  | { type: "functionCall"; name: string; args: Record<string, unknown>; callId: string }
  | { type: "functionResponse"; callId: string; parts: unknown[] }
  | { type: "usageMetadata"; metadata: unknown };

interface TranscriptTurn {
  turn: number;
  events: TranscriptEvent[];
}

export type GraphEditingEvalHarnessRuntimeArgs = {
  invokeAgent: (prompt: string) => Promise<{
    message: string;
    graph: GraphDescriptor;
  }>;
  logger: EvalLogger;
};

export type EvalHarnessSession = {
  eval(evalName: string, fn: GraphEditingEvalHarnessFunction): Promise<void>;
  evalOnly(evalName: string, fn: GraphEditingEvalHarnessFunction): Promise<void>;
};

export type EvalHarnessSessionFunction = (
  session: EvalHarnessSession
) => Promise<void>;

export type GraphEditingEvalHarnessFunction = (
  args: GraphEditingEvalHarnessRuntimeArgs
) => Promise<unknown>;

export type EvalHarnessArgs = {
  name: string;
  uploadToDrive?: boolean;
  folderName?: string;
  batch?: {
    path: string;
    concurrency?: number;
    evaluateWithGemini?: boolean;
    outputCsvPath?: string;
  };
};

type BatchCSVEntry = {
  intent: string;
  breadboard_json: string;
};

export type EvalLogger = {
  log(entry: EvalLogEntry): void;
};

export type EvalLogEntry = { type: string; data: unknown };

function graphEditingSession(
  args: EvalHarnessArgs,
  sessionFunction?: EvalHarnessSessionFunction
) {
  const harness = new GraphEditingEvalHarness(args);
  return harness.session(sessionFunction);
}

class GraphEditingEvalHarness {
  constructor(private readonly args: EvalHarnessArgs) {}

  async session(sessionFunction?: EvalHarnessSessionFunction) {
    const client = await getAuthenticatedClient();
    const accessToken = (await client.getAccessToken()).token;
    if (!accessToken) {
      throw new Error("Unable to obtain access token");
    }

    const batchRowMap = new Map<string, BatchCSVEntry>();
    let capabilitiesMdContent = "";
    let evalSystemInstruction = "";
    const batchCSVRows: {
      original_intent: string;
      breadboard_json: string;
      bgl_json: string;
      rater_json: string;
      transcript_jsonl: string;
    }[] = [];

    // @ts-expect-error "Can't define window?"
    globalThis.window = {
      location: new URL("https://example.com/"),
    } as Window;

    mock.method(globalThis, "setInterval", autoClearingInterval.setInterval);

    const runEvalFn = async (
      evalName: string,
      evalFunction: GraphEditingEvalHarnessFunction
    ): Promise<void> => {
      const logEntries: EvalLogEntry[] = [];
      const run = new GraphEditingEvalRun(accessToken, evalName, {
        log: (entry) => logEntries.push(entry),
      });

      let outcome: unknown;
      try {
        outcome = await evalFunction({
          invokeAgent: async (prompt: string) => {
            const res = await run.invokeAgent(prompt);
            return res;
          },
          logger: run,
        });
      } catch (err: unknown) {
        if ((err as Error).message === "EVAL_DONE") {
          // Gracefully caught the single-shot completion.
          outcome = {
            graph: run.graph,
            finalMessage: run.lastMessage,
          };
        } else {
          throw err;
        }
      }

      await ensureDir(OUT_DIR);
      const filename = `${toKebabFilename(this.args.name)}-${toKebabFilename(evalName)}-${timestamp()}`;
      const harFilename = `${filename}.har`;
      const logFilename = `${filename}.log.json`;
      const graphFilename = `${filename}.bgl.json`;
      const raterFilename = `${filename}.rater.json`;
      const transcriptFilename = `${filename}.transcript.jsonl`;
      let wroteRater = false;


      const isCSVBatch = this.args.batch?.path.endsWith(".csv");
      const csvEntry = batchRowMap.get(evalName);

      if (isCSVBatch && csvEntry) {
        let raterOutput: unknown = null;
        try {
          console.log(`[Eval] Evaluating "${evalName}" with gemini-3.5-flash...`);
          const evalResponseSchema: GeminiSchema = {
            type: "object",
            properties: {
              translated_intent: {
                type: "string",
                description: "The original User Intent translated accurately into English.",
              },
              overall_judgement: {
                type: "string",
                enum: ["PASS", "PARTIAL", "FAIL"],
              },
              overall_rationale: {
                type: "string",
              },
              dimensions: {
                type: "object",
                properties: {
                  intent_fulfillment: {
                    type: "object",
                    properties: {
                      score: { 
                        type: "integer", 
                        description: "Score from 1 (Poor) to 5 (Excellent). Does the generated graph conceptually and functionally satisfy the User's original objective and instructions?" 
                      },
                      rationale: { type: "string" },
                    },
                    required: ["score", "rationale"],
                  },
                  architectural_elegance: {
                    type: "object",
                    properties: {
                      score: { 
                        type: "integer", 
                        description: "Score from 1 (Poor) to 5 (Excellent). Evaluates integrity of data flows, resilience of connections, and whether Opie gracefully leveraged modern Agentic Steps to surpass outdated reference pipelines (without leaving disconnected edges)." 
                      },
                      rationale: { type: "string" },
                    },
                    required: ["score", "rationale"],
                  },
                  capability_utilization: {
                    type: "object",
                    properties: {
                      score: { 
                        type: "integer", 
                        description: "Score from 1 (Poor) to 5 (Excellent). Checks whether Opie correctly selected and configured the optimal Opal tools (Python sandboxing, Veo 3 video with native audio, multi-turn chat, memory, etc.) for the specific task at hand." 
                      },
                      rationale: { type: "string" },
                    },
                    required: ["score", "rationale"],
                  },
                  output_and_polish: {
                    type: "object",
                    properties: {
                      score: { 
                        type: "integer", 
                        description: "Score from 1 (Poor) to 5 (Excellent). If rendering or interactive output is requested, assesses whether the design requirements, aesthetic keywords, and UI structural paradigms were gracefully set up for premium display." 
                      },
                      rationale: { type: "string" },
                    },
                    required: ["score", "rationale"],
                  },
                },
                required: ["intent_fulfillment", "architectural_elegance", "capability_utilization", "output_and_polish"],
              },
              detailed_comparison: {
                type: "string",
              },
            },
            required: ["translated_intent", "overall_judgement", "overall_rationale", "dimensions"],
          };

          const body: GeminiBody = {
            contents: [
              toLLMContent(JSON.stringify({
                intent: csvEntry.intent,
                expected_graph: JSON.parse(csvEntry.breadboard_json),
                generated_graph: run.graph,
                opie_message: run.lastMessage || null,
                followup_question_asked: (run.graph.nodes?.length ?? 0) === 0 && !!run.lastMessage,
              })),
            ],
            systemInstruction: toLLMContent(evalSystemInstruction, "user"),
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: evalResponseSchema,
            },
          };

          const evalOutcome = await withRetry(async () => {
            const res = await generateContent("gemini-3.5-flash", body, {
              fetchWithCreds: run.fetchWithCreds,
              context: { signal: undefined },
            } as unknown as A2ModuleArgs);
            return res;
          });

          if (ok(evalOutcome) && typeof evalOutcome === "object" && !("$error" in evalOutcome)) {
            const candidates = (evalOutcome as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates;
            const firstPart = candidates?.[0]?.content?.parts?.[0];
            let parsed: { translated_intent?: string; overall_judgement?: string; overall_rationale?: string } | null = null;
            if (typeof evalOutcome === "string") {
              try {
                parsed = JSON.parse(evalOutcome);
                raterOutput = parsed;
              } catch {
                raterOutput = { raw_text: evalOutcome, error: "JSON Parse Failed" };
              }
            } else if (firstPart && typeof firstPart === "object" && "text" in firstPart && typeof firstPart.text === "string") {
              try {
                parsed = JSON.parse(firstPart.text);
                raterOutput = parsed;
              } catch {
                raterOutput = { raw_text: firstPart.text, error: "JSON Parse Failed" };
              }
            } else {
              raterOutput = { api_response: evalOutcome, error: "No candidates or text parts in response" };
            }
            

          } else {
            const errPayload = evalOutcome as { $error?: string };
            console.error("[Eval] Gemini evaluation API failed:", errPayload?.$error || "Unknown Error");

            raterOutput = {
              error: "Gemini evaluation API failed",
              details: errPayload?.$error || evalOutcome,
            };
          }
        } catch (e) {
          console.error("[Eval] Exception during Gemini evaluation:", (e as Error).message);

          raterOutput = {
            error: "Exception during Gemini evaluation",
            details: (e as Error).message,
          };
        }

        if (raterOutput) {
          try {
            console.log(`[Eval] Writing rater output to "${raterFilename}"...`);
            await writeFile(
              join(OUT_DIR, raterFilename),
              JSON.stringify(raterOutput, null, 2),
              "utf-8"
            );
            wroteRater = true;
          } catch (writeErr) {
            console.error("[Eval] Failed to write rater output file:", (writeErr as Error).message);
          }
        }

        const transcriptJsonl = (run.transcriptTurns && run.transcriptTurns.length > 0)
          ? run.transcriptTurns
              .map((turn) => JSON.stringify(turn))
              .join("\n")
          : "";

        batchCSVRows.push({
          original_intent: csvEntry.intent,
          breadboard_json: csvEntry.breadboard_json,
          bgl_json: JSON.stringify(run.graph, null, 2),
          rater_json: raterOutput ? JSON.stringify(raterOutput, null, 2) : "",
          transcript_jsonl: transcriptJsonl,
        });
      }

      const har = run.requestLogger.getHar();
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
      await writeFile(
        join(OUT_DIR, `${graphFilename}`),
        JSON.stringify(run.graph, null, 2),
        "utf-8"
      );

      if (run.transcriptTurns && run.transcriptTurns.length > 0) {
        console.log(`[Eval] Writing transcript to "${transcriptFilename}"...`);
        const jsonlContent = run.transcriptTurns
          .map((turn) => JSON.stringify(turn))
          .join("\n");
        await writeFile(
          join(OUT_DIR, transcriptFilename),
          jsonlContent,
          "utf-8"
        );
      }

      let driveUrl: string | undefined = undefined;

      if (this.args.uploadToDrive) {
        try {
          const driveClient = new GoogleDriveClient({
            fetchWithCreds: run.fetchWithCreds,
          });

          const folderName = this.args.folderName || "Opal Eval Outputs";
          const folderQuery = `name="${folderName}" and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}" and 'me' in owners and trashed=false`;
          const folderResult = await driveClient.listFiles(folderQuery, { fields: ["id"] });
          let folderId: string;

          if (folderResult.files && folderResult.files.length > 0) {
            folderId = folderResult.files[0].id!;
          } else {
            console.log(`[Google Drive] Creating folder "${folderName}"...`);
            const createdFolder = await driveClient.createFile(
              "",
              {
                name: folderName,
                mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
              }
            );
            folderId = (createdFolder as unknown as { id: string }).id;
          }

          console.log(`[Google Drive] Uploading Opal "${run.graph.title || "Untitled"}"...`);
          const graphData = JSON.stringify(run.graph, null, 2);
          const uploadedFile = await driveClient.createFile(
            graphData,
            {
              name: `${run.graph.title || "Untitled"}.bgl.json`,
              mimeType: GRAPH_MIME_TYPE,
              parents: [folderId],
            }
          );
          const fileId = (uploadedFile as unknown as { id?: string }).id;
          if (fileId) {
            driveUrl = `http://drive.google.com/open?id=${fileId}`;
          }
        } catch (e) {
          console.error("[Google Drive] Failed to upload graph to Drive:", (e as Error).message);
        }
      }

      console.log(`\n\n${evalName}`);
      console.log(`HAR: "${harFilename}"`);
      console.log(`Log: "${logFilename}"`);
      console.log(`Graph: "${graphFilename}"`);
      if (run.transcriptTurns && run.transcriptTurns.length > 0) {
        console.log(`Transcript: "${transcriptFilename}"`);
      }
      if (wroteRater) {
        console.log(`Rater Output: "${raterFilename}"`);
      }
      if (driveUrl) {
        console.log(`Drive URL: \x1b[36m${driveUrl}\x1b[0m`);
      }
      
      console.log("\nGenerated Graph Summary:");
      console.table(
        (run.graph.nodes ?? []).map((n) => ({
          ID: n.id,
          Type: n.type,
          Title: n.metadata?.title ?? "",
        }))
      );
    };

    const evalTargets = {
      eval: new Map<string, GraphEditingEvalHarnessFunction>(),
      evalOnly: new Map<string, GraphEditingEvalHarnessFunction>(),
    };

    const sessionEvalFn = async (
      target: "eval" | "evalOnly",
      evalName: string,
      evalFunction: GraphEditingEvalHarnessFunction
    ): Promise<void> => {
      evalTargets[target].set(evalName, evalFunction);
    };

    if (sessionFunction) {
      await sessionFunction({
        evalOnly: sessionEvalFn.bind(null, "evalOnly"),
        eval: sessionEvalFn.bind(null, "eval"),
      });
    }

    if (this.args.batch) {
      try {
        const capabilitiesPath = join(ROOT_DIR, "src", "a2", "agent", "graph-editing", "instructions", "04-agent-step.md");
        try {
          const rawCapabilities = await readFile(capabilitiesPath, "utf-8");
          const TOOL_NAMES = A2_TOOLS.map(
            ([, tool]) =>
              `- ${(tool.title ?? "").toLowerCase().replace(/\s+/g, "-")} — ${tool.description}`
          ).join("\n");
          capabilitiesMdContent = rawCapabilities.replaceAll("{{TOOL_NAMES}}", TOOL_NAMES);
        } catch {
          console.warn(`[Batch] Could not locate capabilities.md at ${capabilitiesPath}`);
        }

        const evaluatorInstructionPath = join(ROOT_DIR, "eval", "instructions", "evaluator.md");
        try {
          const rawEvaluatorInstruction = await readFile(evaluatorInstructionPath, "utf-8");
          evalSystemInstruction = rawEvaluatorInstruction.replaceAll(
            "{{CAPABILITIES}}", 
            capabilitiesMdContent
          );
        } catch (err) {
          throw new Error(`[Batch] Could not locate or process evaluator.md at ${evaluatorInstructionPath}: ${(err as Error).message}`);
        }
        
        let filePath = join(ROOT_DIR, this.args.batch.path);
        try {
          await stat(filePath);
        } catch {
          filePath = join(ROOT_DIR, "..", "..", this.args.batch.path);
          try {
            await stat(filePath);
          } catch {
            filePath = join(ROOT_DIR, "..", this.args.batch.path);
          }
        }
        console.log(`[Batch] Reading intents from "${filePath}"...`);
        const content = await readFile(filePath, "utf-8");

        const entries: [string, string][] = [];
        const isCSVBatch = filePath.endsWith(".csv");

        if (isCSVBatch) {
          let inQuotes = false;
          let currentField = "";
          let currentRow: string[] = [];

          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              currentRow.push(currentField.trim());
              currentField = "";
            } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
              if (char === '\r') i++;
              currentField = currentField.trim();
              if (currentField || currentRow.length > 0) {
                currentRow.push(currentField);
                if (currentRow.length === 2) {
                  if (currentRow[0] !== "intent" || currentRow[1] !== "breadboard_json") {
                    entries.push([currentRow[0], currentRow[1]]);
                  }
                }
              }
              currentRow = [];
              currentField = "";
            } else {
              currentField += char;
            }
          }

          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.length === 2) {
              if (currentRow[0] !== "intent" || currentRow[1] !== "breadboard_json") {
                entries.push([currentRow[0], currentRow[1]]);
              }
            }
          }

          console.log(`[Batch] Parsed ${entries.length} CSV rows.`);
          for (let i = 0; i < entries.length; i++) {
            const [intent, breadboard_json] = entries[i];
            const evalName = `batch-intent-${String(i + 1).padStart(2, "0")}`;
            batchRowMap.set(evalName, { intent, breadboard_json });
            evalTargets.eval.set(evalName, async ({ invokeAgent }) => {
              return await invokeAgent(intent);
            });
          }
        } else {
          const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith("#"));

          console.log(`[Batch] Found ${lines.length} intents.`);
          for (let i = 0; i < lines.length; i++) {
            const intent = lines[i];
            evalTargets.eval.set(`batch-intent-${String(i + 1).padStart(2, "0")}`, async ({ invokeAgent }) => {
              return await invokeAgent(intent);
            });
          }
        }
      } catch (err) {
        console.error("[Batch] Failed to load batch intents file:", (err as Error).message);
      }
    }

    const runEvalTargets =
      evalTargets.evalOnly.size > 0
        ? [...evalTargets.evalOnly]
        : [...evalTargets.eval];
    if (evalTargets.evalOnly.size > 0) {
      console.warn(`Exclusive evaluations: ${evalTargets.evalOnly.size}`);
    }

    const concurrency = this.args.batch?.concurrency || 1;
    console.log(`[Batch] Running ${runEvalTargets.length} evaluations with concurrency = ${concurrency}`);

    const chunks: [string, GraphEditingEvalHarnessFunction][][] = [];
    for (let i = 0; i < runEvalTargets.length; i += concurrency) {
      chunks.push(runEvalTargets.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(([name, fn]) => runEvalFn(name, fn)));
    }

    if (batchCSVRows.length > 0) {
      const outputCsvPath = this.args.batch?.outputCsvPath || 
                           join(OUT_DIR, `batch-results-${timestamp()}.csv`);
      await ensureDir(dirname(outputCsvPath));
      console.log(`[Batch] Writing ${batchCSVRows.length} results to "${outputCsvPath}"...`);

      const toCSVCell = (str: string): string => {
        if (str === undefined || str === null) return '""';
        const escaped = String(str).replace(/"/g, '""');
        return `"${escaped}"`;
      };

      let csvContent = "original_intent,breadboard_json,bgl_json,rater_json,transcript_jsonl\n";
      for (const row of batchCSVRows) {
        csvContent += `${toCSVCell(row.original_intent)},${toCSVCell(row.breadboard_json)},${toCSVCell(row.bgl_json)},${toCSVCell(row.rater_json)},${toCSVCell(row.transcript_jsonl)}\n`;
      }

      await writeFile(outputCsvPath, csvContent, "utf-8");
      console.log(`[Batch] Completed writing CSV!`);
    }

    mock.restoreAll();
    autoClearingInterval.clearAllIntervals();
    process.exit(0);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  initialDelayMs = 4000
): Promise<T> {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result && typeof result === "object" && "$error" in result) {
        const errPayload = result as { $error?: string; error?: string };
        const errMsg = errPayload.$error || errPayload.error || "";
        if (
          errMsg.includes("high demand") || 
          errMsg.includes("429") || 
          errMsg.includes("resource_exhausted") ||
          errMsg.includes("Spikes in demand")
        ) {
          if (attempt === maxRetries) {
             throw new Error(errMsg);
          }
          console.log(`[Retry] Model experiencing high demand. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }
      return result;
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (
        msg.includes("high demand") || 
        msg.includes("429") || 
        msg.includes("resource_exhausted") ||
        msg.includes("Spikes in demand")
      ) {
        if (attempt === maxRetries) {
           throw err;
        }
        console.log(`[Retry] Hit demand limits. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Retry exhausted");
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

class GraphEditingEvalRun implements EvalLogger {
  readonly graph: GraphDescriptor = {
    title: "",
    description: "",
    nodes: [],
    edges: [],
  };

  lastMessage: string = "";
  readonly transcriptTurns: TranscriptTurn[] = [];
  private readonly translator = new EditingAgentPidginTranslator();

  constructor(
    private readonly accessToken: string,
    private readonly title: string,
    public readonly logger: EvalLogger
  ) {
    this.graph.title = this.title;
  }

  readonly requestLogger = new Logger();

  log(entry: EvalLogEntry): void {
    this.logger.log(entry);
  }

  public fetchWithCreds = async (
    url: RequestInfo | URL,
    init?: RequestInit
  ) => {
    let urlStr = String(url);
    if (urlStr.includes("https://appcatalyst.pa.googleapis.com/v1beta1")) {
      urlStr = urlStr.replace(
        "https://appcatalyst.pa.googleapis.com/v1beta1",
        "https://generativelanguage.googleapis.com/v1beta"
      );
    }
    const entryId = this.requestLogger.request(urlStr, init);
    const response = await fetch(urlStr, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    await this.requestLogger.response(entryId, response.clone());
    return response;
  };

  async invokeAgent(promptText: string): Promise<{
    message: string;
    graph: GraphDescriptor;
  }> {
    const consumer = new AgentEventConsumer();
    const sink = new LocalAgentEventBridge(consumer);

    const hooks = buildHooksFromSink(sink);

    let currentTurn: TranscriptTurn = {
      turn: 1,
      events: [],
    };

    const finalizeCurrentTurn = () => {
      if (currentTurn.events.length > 0) {
        this.transcriptTurns.push({ ...currentTurn });
        currentTurn = {
          turn: this.transcriptTurns.length + 1,
          events: [],
        };
      }
    };

    consumer.on("start", (payload) => {
      const text = payload.objective.parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
      currentTurn.events.push({ type: "objective", text });
    });

    consumer.on("thought", (payload) => {
      currentTurn.events.push({ type: "thought", text: payload.text });
    });

    consumer.on("functionCall", (payload) => {
      currentTurn.events.push({
        type: "functionCall",
        name: payload.name,
        args: payload.args,
        callId: payload.callId,
      });
    });

    consumer.on("functionResult", (payload) => {
      currentTurn.events.push({
        type: "functionResponse",
        callId: payload.callId,
        parts: payload.content.parts as unknown[],
      });
    });

    consumer.on("usageMetadata", (payload) => {
      currentTurn.events.push({
        type: "usageMetadata",
        metadata: payload.metadata,
      });
    });

    consumer.on("turnComplete", () => {
      finalizeCurrentTurn();
    });

    consumer.on("readGraph", () => {
      return Promise.resolve({ graph: this.graph });
    });

    consumer.on("applyEdits", async (event) => {
      const editor = HeadlessGraphEditor.create(this.graph);
      const manager = new GraphEditingManager(editor);
      const result = await manager.applyEdits(event);
      return result;
    });

    consumer.on("waitForInput", (event) => {
      const message = event.prompt.parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
      this.lastMessage = message;
      // Single-shot termination. Throwing in the suspend handler gracefully
      // halts Loop execution, bypassing continuing turns.
      throw new Error("EVAL_DONE");
    });

    const objective: LLMContent = {
      role: "user",
      parts: [{ text: promptText }],
    };

    const moduleArgs: A2ModuleArgs = {
      mcpClientManager: {} as unknown as McpClientManager,
      agentContext: new AgentContext({
        shell: {} as unknown as OpalShellHostProtocol,
        fetchWithCreds: this.fetchWithCreds,
      }),
      fetchWithCreds: this.fetchWithCreds,
      getConsentController() {
        return {
          async queryConsent() {
            return true;
          },
        } as Partial<ConsentController> as ConsentController;
      },
      notebookLmApiClient: {} as never,
      agentService: new AgentService(),
      googleDriveClient: {} as never,
      context: {
        currentGraph: this.graph,
        currentStep: {
          id: "current-step",
          type: "mock",
        },
        getProjectRunState: () => {
          return {
            console: new Map(),
            app: {
              state: "splash",
              screens: new Map(),
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
        getOpalBackendClient: async () => new HttpBackendClient(globalThis.fetch),
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
        setTitle: function (_title: string | null): void {
          throw new Error("Function not implemented.");
        },
        setOneGoogleBarVisible: function (_visible: boolean): void {
          // No-op in eval harness.
        },
      } satisfies OpalShellHostProtocol,
    };

    try {
      const outcome = await withRetry(async () => {
        const res = await invokeGraphEditingAgent(objective, moduleArgs, sink, this.translator, hooks);
        return res;
      });

      if (!ok(outcome)) {
        const errPayload = outcome as unknown as { $error?: string; error?: string };
        if (errPayload.$error === "EVAL_DONE" || errPayload.error === "EVAL_DONE") {
          return {
            message: this.lastMessage,
            graph: this.graph,
          };
        }
        throw new Error(`Agent execution failed: ${errPayload.$error ?? errPayload.error}`);
      }

      return {
        message: this.lastMessage,
        graph: this.graph,
      };
    } finally {
      finalizeCurrentTurn();
    }
  }
}
