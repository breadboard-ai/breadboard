
export { executeOpalAdkStream };
export type { StreamingRequestBody, StreamChunk };

import {
  Capabilities,
  FileSystemReadWritePath,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { StreamableReporter } from "./output.js";
import {
  decodeBase64,
  encodeBase64,
  err,
  ok,
  toLLMContent,
} from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

const DEFAULT_OPAL_ADK_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeStepStream";

type StreamChunk = {
  mimetype: string;
  data: any;
  metadata?: {
    chunk_type: string;
  };
};


export type Content = {
  chunks: StreamChunk[];
};

export type ContentMap = {
  [key: string]: Content;
};


export type PlanStep = {
  stepName: string;
  modelApi: string;
  inputParameters: string[];
  output?: string;
};


type StreamingRequestBody = {
  planStep: PlanStep;
  executionInputs: ContentMap;
};

async function getOpalAdkBackendUrl(caps: Capabilities) {
  type BackendSettings = { endpoint_url: string };
  const reading = await caps.read({ path: "/env/settings/opalAdkBackend" });
  if (ok(reading)) {
    const part = reading.data?.at(0)?.parts?.at(0);
    if (part && "json" in part) {
      const settings = part.json as BackendSettings;
      if (settings?.endpoint_url) {
        // Extract base URL and append the streaming endpoint path
        const url = new URL(settings.endpoint_url);
        url.pathname = "/v1beta1/executeStepStream";
        return url.toString();
      }
    }
  }
  return DEFAULT_OPAL_ADK_ENDPOINT;
}

function buildStreamingRequestBody(
  opal_adk_agent: string,
  params: Record<string, string>
): StreamingRequestBody {
  const inputParameters = Object.keys(params);
  const execution_inputs = Object.fromEntries(
    Object.entries(params).map(([name, value]) => {
      return [
        name,
        {
          chunks: [
            {
              mimetype: "text/plain",
              data: encodeBase64(value),
            },
          ],
        },
      ];
    })
  );
  return {
    planStep: {
      stepName: "plan_step",
      modelApi: opal_adk_agent,
      inputParameters: inputParameters,
    },
    executionInputs: execution_inputs,
  };
}


async function executeOpalAdkStream(caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  params: Record<string, string>,
  opal_adk_agent: string): Promise<Outcome<LLMContent>> {
  console.log("params: ", params);
  const reporter = new StreamableReporter(caps, {
    title: `Executing Opal Adk with ${opal_adk_agent}`,
    icon: "spark",
  });
  try {
    await reporter.start();
    await reporter.sendUpdate("Preparing request", { opal_adk_agent }, "upload");

    const baseUrl = await getOpalAdkBackendUrl(caps);
    const url = new URL(baseUrl);
    url.searchParams.set("alt", "sse");
    const requestBody = buildStreamingRequestBody(
      opal_adk_agent,
      params
    );

    // Record model call with action tracker
    caps.write({
      path: `/mnt/track/call_${opal_adk_agent}` as FileSystemReadWritePath,
      data: [],
    });

    const response = await moduleArgs.fetchWithCreds(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: moduleArgs.context.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return reporter.sendError(
        err(`Streaming request failed: ${response.status} ${errorText}`)
      );
    }

    if (!response.body) {
      return reporter.sendError(err("No response body from streaming API"));
    }

    // Process the SSE stream
    let researchResult = "";
    let thoughtCount = 0;
    for await (const chunk of iteratorFromStream<StreamChunk>(response.body)) {
      if (!chunk) continue;
      console.log("chunk", chunk);
      console.log("chunk data: ", decodeBase64(chunk.data))
      const chunkType = chunk.mimetype;
      const text = decodeBase64(chunk.data);

      if (chunkType === "thought") {
        thoughtCount++;
        await reporter.sendUpdate(
          `Thinking (${thoughtCount})`,
          text,
          "spark"
        );
      } else if (chunkType === "text/plain") {
        researchResult = text;
        console.log("Updating output")
        await reporter.sendUpdate(
          "Agent Thought",
          researchResult,
          "spark"
        );
      } else if (chunkType === "error") {
        return reporter.sendError(err(`Generation error: ${text}`));
      }
    }

    if (!researchResult) {
      return reporter.sendError(err("No research result received from stream"));
    }

    // Return HTML as inlineData with text/html mimeType to match legacy behavior
    return toLLMContent(researchResult, 'model');
  } catch (e) {
    return reporter.sendError(err((e as Error).message));
  } finally {
    reporter.close();
  }
}