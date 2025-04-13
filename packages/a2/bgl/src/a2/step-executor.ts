/**
 * @fileoverview Utilities to execute tools on the AppCatalyst backend server.
 */

export { executeStep, executeTool };

import fetch from "@fetch";
import secrets from "@secrets";
import { ok, err } from "./utils";

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
};

function maybeExtractError(e: string): string {
  try {
    const parsed = JSON.parse(e);
    return parsed.error.message;
  } catch (error) {
    return e;
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
          chunks: [{ mimetype: "text/plan", data: btoa(value) }],
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

  const data = response?.executionOutputs["data"].chunks.at(0)?.data;
  if (!data) {
    return err(`Invalid response from "${api}" backend`);
  }
  const jsonString = atob(data);
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    return jsonString;
  }
}

async function executeStep(
  body: ExecuteStepRequest
): Promise<Outcome<ExecuteStepResponse>> {
  // Get an authentication token.
  const key = "connection:$sign-in";
  const token = (await secrets({ keys: [key] }))[key];
  // Call the API.
  const url =
    "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeStep";
  const fetchResult = await fetch({
    url: url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body,
  });
  let $error: string = "Unknown error";
  if (!ok(fetchResult)) {
    const { status, $error: errObject } = fetchResult as FetchErrorResponse;
    console.warn($error);
    if (!status) {
      // This is not an error response, presume fatal error.
      return { $error };
    }
    $error = maybeExtractError(errObject);
    return { $error };
  }
  const response = fetchResult.response as ExecuteStepResponse;
  return response;
}
