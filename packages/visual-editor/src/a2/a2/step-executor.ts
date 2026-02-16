/**
 * @fileoverview Utilities to execute tools on the AppCatalyst backend server.
 */

export { executeStep, executeTool, parseExecutionOutput };
export type { ExecuteStepArgs };

import {
  Capabilities,
  InlineDataCapabilityPart,
  JsonSerializable,
  LLMContent,
  OPAL_BACKEND_API_PREFIX,
  Outcome,
} from "@breadboard-ai/types";
import {
  getCurrentStepState,
  createReporter,
  type ProgressReporter,
} from "../agent/progress-work-item.js";
import {
  decodeBase64,
  encodeBase64,
  err,
  ErrorMetadata,
  ErrorWithMetadata,
  ok,
  toLLMContentInline,
  toLLMContentStored,
} from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { setScreenDuration } from "../../sca/utils/app-screen.js";

const BACKEND_ENDPOINT = new URL("v1beta1/executeStep", OPAL_BACKEND_API_PREFIX)
  .href;

type Chunk = {
  mimetype: string;
  data: string;
  substreamName?: string;
};

export type Content = {
  chunks: Chunk[];
};

export type ContentMap = {
  [key: string]: Content;
};

export type PlanStep = {
  stepName: string;
  modelApi: string;
  inputParameters: string[];
  systemPrompt?: string;
  stepIntent?: string;
  output?: string;
  isListOutput?: boolean;
  options?: {
    disablePromptRewrite?: boolean;
    renderMode?: string;
    modelName?: string;
    systemInstruction?: string;
  };
};

export type GcsConfig = {
  bucket_name: string;
  folder_path?: string;
  project_name?: string;
};

export type ExecuteStepRequest = {
  planStep: PlanStep;
  execution_inputs: ContentMap;
};

export type ExecuteStepResponse = {
  executionOutputs: ContentMap;
  errorMessage?: string;
};

export type ExecuteStepErrorResponse = {
  error: {
    code: number;
    message: string;
    status: string;
    details: unknown;
  };
};

type ExecutionOutput = {
  chunks: LLMContent[];
  requestedModel?: string;
  executedModel?: string;
};

const GCS_PATH_PREFIX = "text/gcs-path/";

function parseExecutionOutput(input?: Chunk[]): Outcome<ExecutionOutput> {
  let requestedModel: string | undefined = undefined;
  let executedModel: string | undefined = undefined;
  const chunks: LLMContent[] = [];
  input?.forEach((chunk) => {
    if (chunk.substreamName === "requested-model") {
      requestedModel = chunk.data;
    } else if (chunk.substreamName === "executed-model") {
      executedModel = chunk.data;
    } else {
      chunks.push(toLLMContent(chunk));
    }
  });
  if (chunks.length === 0) {
    return err(`Unable to find data in the output`, {
      origin: "server",
      kind: "bug",
    });
  }
  return { chunks, requestedModel, executedModel };

  function toLLMContent({ mimetype, data }: Chunk): LLMContent {
    if (mimetype === "text/html") {
      return toLLMContentInline(mimetype, decodeBase64(data));
    } else if (mimetype.endsWith("/storedData")) {
      return toLLMContentStored(mimetype.replace("/storedData", ""), data);
    } else if (mimetype.startsWith(GCS_PATH_PREFIX)) {
      const gcsPath = new TextDecoder().decode(
        Uint8Array.from(atob(data), (m) => m.codePointAt(0)!)
      );
      const handle = new URL(
        `/board/blobs/${gcsPath.split("/").at(-1)}`,
        window.location.href
      ).href;
      const actualMimeType = mimetype.slice(GCS_PATH_PREFIX.length);
      return toLLMContentStored(actualMimeType, handle);
    }
    return toLLMContentInline(mimetype, data);
  }
}

async function executeTool<
  T extends JsonSerializable = Record<string, JsonSerializable>,
>(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  api: string,
  params: Record<string, string>
): Promise<Outcome<T | string>> {
  const inputParameters = Object.keys(params);
  const execution_inputs = Object.fromEntries(
    Object.entries(params).map(([name, value]) => {
      return [
        name,
        {
          chunks: [
            {
              mimetype: "text/plan",
              data: encodeBase64(value),
            },
          ],
        },
      ];
    })
  );
  const reporter = createReporter(moduleArgs, {
    title: `Calling ${api}`,
    icon: "spark",
  });
  const response = await executeStep(
    caps,
    { ...moduleArgs, reporter },
    {
      planStep: {
        stepName: api,
        modelApi: api,
        output: "data",
        inputParameters,
        isListOutput: false,
      },
      execution_inputs,
    }
  );
  if (!ok(response)) return response;

  const {
    inlineData: { data },
  } = response.chunks.at(0)!.parts.at(0) as InlineDataCapabilityPart;
  const jsonString = decodeBase64(data!);
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return jsonString;
  }
}

type ProgressUpdateOptions = {
  message?: string;
  expectedDurationInSec?: number;
};

/**
 * Args for executeStep - A2ModuleArgs augmented with a reporter.
 */
type ExecuteStepArgs = A2ModuleArgs & { reporter: ProgressReporter };

async function executeStep(
  _caps: Capabilities,
  args: ExecuteStepArgs,
  body: ExecuteStepRequest,
  progressUpdateOptions?: ProgressUpdateOptions
): Promise<Outcome<ExecutionOutput>> {
  const { fetchWithCreds, context, reporter } = args;
  const model = body.planStep.options?.modelName || body.planStep.stepName;
  const { appScreen, title } = getCurrentStepState(args);
  try {
    if (appScreen) {
      appScreen.progress = progressUpdateOptions?.message || title;
      if (progressUpdateOptions?.expectedDurationInSec) {
        setScreenDuration(
          appScreen,
          progressUpdateOptions.expectedDurationInSec
        );
      } else {
        setScreenDuration(appScreen, -1);
      }
    }

    reporter.addJson("Step Input", elideEncodedData(body), "upload");
    // Call the API.
    const url = BACKEND_ENDPOINT;
    let response: ExecuteStepResponse;
    try {
      const fetchResponse = await fetchWithCreds(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: context.signal,
        body: JSON.stringify(body),
      });
      if (!fetchResponse.ok) {
        const { $error, metadata } = decodeFetchError(
          await fetchResponse.text(),
          model
        );
        return reporter.addError(err($error, metadata));
      }
      response = await fetchResponse.json();
    } catch (e) {
      return reporter.addError(
        err((e as Error).message, {
          origin: "server",
          model,
        })
      );
    }
    if (!response) {
      return reporter.addError(
        err(`Request to "${model}" failed, please try again`, {
          origin: "server",
          kind: "bug",
        })
      );
    }
    if (response.errorMessage) {
      const errorMessage = decodeMetadata(response.errorMessage, model);
      return reporter.addError(err(errorMessage.$error, errorMessage.metadata));
    }
    reporter.addJson("Step Output", elideEncodedData(response), "download");
    const output_key = body.planStep.output || "";
    return parseExecutionOutput(response.executionOutputs[output_key]?.chunks);
  } finally {
    reporter.finish();
    if (appScreen) {
      appScreen.progress = undefined;
      setScreenDuration(appScreen, -1);
    }
  }
}

export function elideEncodedData<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) return obj.map((item) => elideEncodedData(item)) as T;

  // Handle Objects
  const o: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (key === "chunks" && Array.isArray(value)) {
        const areChunksValid = (value as unknown[]).every(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            "mimetype" in item &&
            typeof (item as Chunk).mimetype === "string" &&
            "data" in item &&
            typeof (item as Chunk).data === "string"
        );

        if (areChunksValid) {
          o[key] = (value as Chunk[]).map((chunk) => ({
            ...chunk, // Copy other properties of the chunk
            data: "<base64 encoded data>", // Elide the 'data' field
          }));
        } else {
          // Not a valid 'Content' structure, deep copy as usual
          o[key] = elideEncodedData(value);
        }
      } else {
        // Recursively process nested objects and arrays
        o[key] = elideEncodedData(value);
      }
    }
  }

  return o as T;
}

function decodeMetadata($error: string, model: string): ErrorWithMetadata {
  const origin = "server";
  const lc = $error.toLocaleLowerCase();
  if (lc.includes("safety")) {
    return { $error, metadata: { kind: "safety", origin, model } };
  }
  if (lc.includes("quota")) {
    return { $error, metadata: { kind: "capacity", origin, model } };
  }
  if (lc.includes("recitation")) {
    return { $error, metadata: { kind: "recitation", origin, model } };
  }
  return { $error, metadata: { origin, model } };
}

function decodeFetchError($error: string, model?: string): ErrorWithMetadata {
  try {
    const { error } = JSON.parse($error) as ExecuteStepErrorResponse;
    const kind: ErrorMetadata["kind"] =
      error.status === "INVALID_ARGUMENT" ? "bug" : "unknown";
    return {
      $error: error.message,
      metadata: {
        origin: "server",
        kind,
        model,
      },
    };
  } catch {
    return { $error };
  }
}
