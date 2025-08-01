/**
 * @fileoverview Utilities to execute tools on the AppCatalyst backend server.
 */

export { executeStep, executeTool, parseExecutionOutput };

import fetch from "@fetch";
import secrets from "@secrets";
import read from "@read";
import {
  ok,
  err,
  decodeBase64,
  encodeBase64,
  toLLMContentStored,
  toLLMContentInline,
} from "./utils";
import { StreamableReporter } from "./output";

const DEFAULT_BACKEND_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeStep";

type FetchErrorResponse = {
  $error: string;
  status: number;
  statusText: string;
  contentType: string;
  responseHeaders: Record<string, string>;
};

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
  folder_path: string;
  project_name: string;
};

export type ExecuteStepRequest = {
  planStep: PlanStep;
  execution_inputs: ContentMap;
  output_gcs_config?: GcsConfig;
};

export type ExecuteStepResponse = {
  executionOutputs: ContentMap;
  errorMessage?: string;
};

type ExecutionOutput = {
  chunks: LLMContent[];
  requestedModel?: string;
  executedModel?: string;
};

function maybeExtractError(e: string): string {
  try {
    const parsed = JSON.parse(e);
    return parsed.error.message;
  } catch {
    return e;
  }
}

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
      toLLMContentInline(mimetype, decodeBase64(data));
    } else if (mimetype.endsWith("/storedData")) {
      return toLLMContentStored(mimetype.replace("/storedData", ""), data);
    }
    return toLLMContentInline(mimetype, data);
  }
}

async function executeTool<
  T extends JsonSerializable = Record<string, JsonSerializable>,
>(api: string, params: Record<string, string>): Promise<Outcome<T | string>> {
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
  const response = await executeStep({
    planStep: {
      stepName: api,
      modelApi: api,
      output: "data",
      inputParameters,
      isListOutput: false,
    },
    execution_inputs,
  });
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

type BackendSettings = {
  endpoint_url: string;
};
async function getBackendUrl() {
  const reading = await read({ path: "/env/settings/backend" });
  if (ok(reading)) {
    const part = reading.data?.at(0)?.parts?.at(0);
    if (part && "json" in part) {
      const settings = part.json as BackendSettings;
      if (settings && settings.endpoint_url) {
        return settings.endpoint_url;
      }
    }
  }
  return DEFAULT_BACKEND_ENDPOINT;
}

async function executeStep(
  body: ExecuteStepRequest
): Promise<Outcome<ExecutionOutput>> {
  const model = body.planStep.options?.modelName || body.planStep.stepName;
  const reporter = new StreamableReporter({
    title: `Calling ${model}`,
    icon: "spark",
  });
  try {
    await reporter.start();
    await reporter.sendUpdate("Step Input", elideEncodedData(body), "upload");
    // Get an authentication token.
    const secretKey = "connection:$sign-in";
    const token = (await secrets({ keys: [secretKey] }))[secretKey];
    // Call the API.
    const url = await getBackendUrl();
    const fetchResult = await fetch({
      url: url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body,
    });
    if (!ok(fetchResult)) {
      const { status, $error: errObject } = fetchResult as FetchErrorResponse;
      console.warn("Error response", fetchResult);
      if (!status) {
        if (errObject) {
          return reporter.sendError(
            err(maybeExtractError(errObject), {
              origin: "server",
              model,
            })
          );
        }
        return reporter.sendError(
          err("Unknown error", { origin: "server", model })
        );
      }
      return err(maybeExtractError(errObject), {
        origin: "server",
        model,
      });
    }
    const response = fetchResult.response as ExecuteStepResponse;
    if (response.errorMessage) {
      return err(response.errorMessage, {
        origin: "server",
        model,
      });
    }
    await reporter.sendUpdate(
      "Step Output",
      elideEncodedData(response),
      "download"
    );
    const output_key = body.planStep.output || "";
    return parseExecutionOutput(response.executionOutputs[output_key]?.chunks);
  } finally {
    await reporter.close();
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
