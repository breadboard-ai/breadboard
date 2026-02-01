export { executeOpalAdkStream };
export type { StreamingRequestBody, StreamChunk };

import {
  Capabilities,
  FileSystemReadWritePath,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { StreamableReporter } from "./output.js";
import { err, ok, toLLMContent } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { iteratorFromStream } from "@breadboard-ai/utils";

const DEFAULT_OPAL_ADK_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeAgentNodeStream";

type StreamChunk = {
  parts?: Array<{
    text?: string;
    partMetadata?: {
      chunk_type?: string;
    };
  }>;
  role?: string;
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

type StreamingRequestPart = {
  text?: string;
  partMetadata?: { input_name: string };
};

type StreamingRequestBody = {
  model_name?: string;
  node_api?: string;
  contents: Array<{
    parts: StreamingRequestPart[];
    role: string;
  }>;
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
        url.pathname = "/v1beta1/executeAgentNodeStream";
        return url.toString();
      }
    }
  }
  return DEFAULT_OPAL_ADK_ENDPOINT;
}

function buildStreamingRequestBody(
  content: LLMContent[],
  node_api: string = "deep_research"
): StreamingRequestBody {
  const contents: StreamingRequestBody["contents"] = [];

  let textCount = 0;
  for (const val of content) {
    if (!val.parts) continue;
    for (const part of val.parts) {
      if ("text" in part) {
        textCount++;
        contents.push({
          parts: [
            {
              text: part.text,
              partMetadata: { input_name: `text_${textCount}` },
            },
          ],
          role: "user",
        });
      }
    }
  }

  return {
    node_api: node_api,
    contents: contents,
  };
}

async function executeOpalAdkStream(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  params: LLMContent[],
  opal_adk_agent: string
): Promise<Outcome<LLMContent>> {
  const reporter = new StreamableReporter(moduleArgs, {
    title: `Executing Opal Adk with ${opal_adk_agent}`,
    icon: "spark",
  });
  try {
    await reporter.start();
    await reporter.sendUpdate(
      "Preparing request",
      { opal_adk_agent },
      "upload"
    );

    const baseUrl = await getOpalAdkBackendUrl(caps);
    const url = new URL(baseUrl);
    url.searchParams.set("alt", "sse");
    const requestBody = buildStreamingRequestBody(params, opal_adk_agent);

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
      if (!chunk || !chunk.parts) continue;
      for (const part of chunk.parts) {
        const type = part.partMetadata?.chunk_type;
        const text = part.text || "";
        if (type === "thought") {
          thoughtCount++;
          await reporter.sendUpdate(
            `Thinking (${thoughtCount})`,
            text,
            "spark"
          );
        } else if (type === "result") {
          researchResult = text;
          await reporter.sendUpdate("Agent Thought", researchResult, "spark");
        } else if (type === "error") {
          return reporter.sendError(err(`Generation error: ${text}`));
        }
      }
    }

    if (!researchResult) {
      return reporter.sendError(err("No research result received from stream"));
    }

    // Return HTML as inlineData with text/html mimeType to match legacy behavior
    return toLLMContent(researchResult, "model");
  } catch (e) {
    return reporter.sendError(err((e as Error).message));
  } finally {
    reporter.close();
  }
}
