/**
 * @fileoverview Utilities to execute tools on the AppCatalyst backend server.
 */

export { executeStep };

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

export interface ContentMap {
  [key: string]: Content;
}

export interface ExecuteStepRequest {
  planStep: {
    stepName: string;
    modelApi: string;
    inputParameters: string[];
    systemPrompt: string;
    stepIntent?: string;
    output?: string;
    options?: {
      disablePromptRewrite: boolean;
      renderMode: string;
    };
  };
  execution_inputs: ContentMap;
}

export interface ExecuteStepResponse {
  executionOutputs: ContentMap;
}

function maybeExtractError(e: string): string {
  try {
    const parsed = JSON.parse(e);
    return parsed.error.message;
  } catch (error) {
    return e;
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
