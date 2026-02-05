export { executeOpalAdkStream, buildStreamingRequestBody };
export type { StreamingRequestBody, StreamChunk };

import {
  Capabilities,
  FileSystemReadWritePath,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok, toLLMContent } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { iteratorFromStream } from "@breadboard-ai/utils";
import { ModelConstraint } from "../agent/functions/generate.js";
import { createReporter, ProgressWorkItem } from "../agent/progress-work-item.js";

const DEFAULT_OPAL_ADK_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeAgentNodeStream";

type StreamChunk = {
  chunk?: {
    parts?: Array<{
      text?: string;
      partMetadata?: {
        chunk_type?: string;
      };
      part_metadata?: {
        chunk_type?: string;
      };
    }>;
  };
  parts?: Array<{
    text?: string;
    partMetadata?: {
      chunk_type?: string;
    };
    part_metadata?: {
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
  objective?: LLMContent;
  model_name?: string;
  invocation_id?: string;
  contents?: Array<{
    parts: StreamingRequestPart[];
    role: string;
  }>;
  node_config?: {
    node_api?: string;
  };
  agent_mode_node_config?: {
    model_constraint?: string;
    ui_type?: string;
    ui_prompt?: LLMContent;
  };
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


export interface BuildStreamingRequestBodyOptions {
  content?: LLMContent[];
  objective?: LLMContent;
  modelConstraint?: string;
  uiType?: string;
  uiPrompt?: LLMContent;
  node_api?: string;
  invocation_id?: string;
}

function toProtoModelConstraint(modelConstraint: ModelConstraint): string {
  switch (modelConstraint) {
    case "text-pro":
      return "MODEL_CONSTRAINT_TEXT_PRO";
    case "text-flash":
      return "MODEL_CONSTRAINT_TEXT_FLASH";
    case "image":
      return "MODEL_CONSTRAINT_IMAGE";
    case "video":
      return "MODEL_CONSTRAINT_VIDEO";
    case "speech":
      return "MODEL_CONSTRAINT_SPEECH";
    case "music":
      return "MODEL_CONSTRAINT_MUSIC";
    default:
      return "MODEL_CONSTRAINT_UNSPECIFIED";
  }
}

function toProtoUIType(uiType: string): string {
  switch (uiType) {
    case "chat":
      return "UI_TYPE_CHAT";
    case "a2ui":
      return "UI_TYPE_A2UI";
    case "none":
      return "UI_TYPE_NONE";
    default:
      return "UI_TYPE_UNSPECIFIED";
  }
}

function buildStreamingRequestBody(options: BuildStreamingRequestBodyOptions): StreamingRequestBody {
  const {
    content = [],
    objective,
    modelConstraint,
    uiType,
    uiPrompt,
    node_api,
    invocation_id,
  } = options;
  console.log("uiType: ", uiType);
  const contents: NonNullable<StreamingRequestBody["contents"]> = [];

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

  const baseBody: StreamingRequestBody = {
    objective,
    model_name: undefined, // model_name is not currently passed in options or used in original code, leaving undefined or could be added to options if needed
    invocation_id,
    contents,
  };

  if (node_api) {
    baseBody.node_config = {
      node_api,
    };
  } else {
    baseBody.agent_mode_node_config = {};
    if (modelConstraint !== undefined) {
      baseBody.agent_mode_node_config.model_constraint = modelConstraint;
    }
    if (uiType !== undefined) {
      baseBody.agent_mode_node_config.ui_type = toProtoUIType(uiType);
    }
    if (uiPrompt !== undefined) {
      baseBody.agent_mode_node_config.ui_prompt = uiPrompt;
    }
  }

  return baseBody;
}


async function executeOpalAdkStream(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  opal_adk_agent?: string,
  params?: LLMContent[],
  objective?: LLMContent,
  modelConstraint?: ModelConstraint,
  uiType?: string,
  uiPrompt?: LLMContent,
  invocation_id?: string): Promise<Outcome<LLMContent>> {
  const reporter = createReporter(moduleArgs, {
    title: `Executing Opal Adk with ${opal_adk_agent}`,
    icon: "spark",
  });
  try {
    reporter.addJson("Preparing request", { opal_adk_agent }, "upload");
    console.log('opal_adk_agent: ', opal_adk_agent);
    const baseUrl = await getOpalAdkBackendUrl(caps);
    const url = new URL(baseUrl);
    url.searchParams.set("alt", "sse");
    let modelConstraintProtoString = (
      modelConstraint && toProtoModelConstraint(modelConstraint)
    ) || "MODEL_CONSTRAINT_UNSPECIFIED";
    const requestBody = buildStreamingRequestBody({
      content: params,
      objective,
      modelConstraint: modelConstraintProtoString,
      uiType,
      uiPrompt,
      node_api: opal_adk_agent,
      invocation_id,
    });

    // Record model call with action tracker
    caps.write({
      path: `/mnt/track/call_${opal_adk_agent}` as FileSystemReadWritePath,
      data: [],
    });

    console.log("Request Body: ", requestBody);
    const response = await moduleArgs.fetchWithCreds(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: moduleArgs.context.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return reporter.addError(
        err(`Streaming request failed: ${response.status} ${errorText}`)
      );
    }

    if (!response.body) {
      return reporter.addError(err("No response body from streaming API"));
    }

    // Process the SSE stream
    let researchResult = "";
    let thoughtCount = 0;
    for await (const chunk of iteratorFromStream<StreamChunk>(response.body)) {
      const result = await parseStreamChunk(chunk, reporter, thoughtCount);
      if (result.thoughtCount !== undefined) {
        thoughtCount = result.thoughtCount;
      }
      if (result.agentResult) {
        researchResult = result.agentResult;
      }
      if (result.error) {
        return reporter.addError(err(result.error));
      }
    }

    if (!researchResult) {
      return reporter.addError(err("No research result received from stream"));
    }

    // Return HTML as inlineData with text/html mimeType to match legacy behavior
    return toLLMContent(researchResult, "model");
  } catch (e) {
    return reporter.addError(err((e as Error).message));
  } finally {
    reporter.finish();
  }
}

/**
 * Parses a single stream chunk and updates the reporter and result variables.
 * Factored out for testability.
 */
export async function parseStreamChunk(
  chunk: StreamChunk,
  reporter: ProgressWorkItem,
  thoughtCount: number
): Promise<{
  thoughtCount?: number;
  agentResult?: string;
  error?: string;
}> {
  if (!chunk) return {};

  const parts = chunk.parts || chunk.chunk?.parts;
  if (!parts) {
    console.warn("Received chunk without parts:", chunk);
    return {};
  }

  let agentResult: string | undefined;
  let currentThoughtCount = thoughtCount;
  let error: string | undefined;

  for (const part of parts) {
    const metadata = part.partMetadata || part.part_metadata;
    const type = metadata?.chunk_type;
    const text = part.text || "";

    if (type === "thought") {
      currentThoughtCount++;
      reporter.addText(`Thinking (${currentThoughtCount})`, text, "spark");
    } else if (
      type === "result" ||
      type === "research" ||
      type === "breadboard" ||
      type === "html"
    ) {
      agentResult = text;
      reporter.addText(`Thought (${text})`, "spark");
    } else if (type === "error") {
      reporter.addError(err(text));
    } else {
      console.log(`Received unknown chunk type: ${type}`);
    }
  }

  return {
    thoughtCount: currentThoughtCount,
    agentResult,
    error,
  };
}