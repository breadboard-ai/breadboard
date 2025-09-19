/**
 * @fileoverview Gets a list of emails
 */

import { type DescribeOutputs } from "@describe";
import { decodeBase64, err } from "../a2/utils";

type FetchErrorResponse = {
  $error: string;
  status: number;
  statusText: string;
  contentType: string;
  responseHeaders: Record<string, string>;
};

function maybeExtractError(e: string): string {
  try {
    const parsed = JSON.parse(e);
    return parsed.error.message;
  } catch {
    return e;
  }
}

import { ok } from "../a2/utils";

export { invoke as default, describe };

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

export interface ExecuteStepResponse {
  executionOutputs: ContentMap;
}

async function invoke(
  _inputs: Record<string, unknown>,
  { fetch, secrets }: Capabilities
) {
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
    body: {
      planStep: {
        stepName: "get_emails",
        modelApi: "get_emails",
        output: "emails",
        inputParameters: [],
        isListOutput: false,
      },
      app_integration_token: token,
    },
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
  const data = response.executionOutputs["get_emails"].chunks.at(0)?.data;
  if (!data) {
    return err(`Invalid response`);
  }

  const emails = decodeBase64(data);

  return { emails };
}

async function describe() {
  return {
    title: "Get emails",
    description: "Gets a list of latest 10 unread emails",
    metadata: {
      icon: "email",
      tags: ["tool"],
    },
    inputSchema: {
      type: "object",
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        emails: {
          type: "string",
          title: "Unread emails",
        },
      },
    } satisfies Schema,
  } satisfies DescribeOutputs;
}
