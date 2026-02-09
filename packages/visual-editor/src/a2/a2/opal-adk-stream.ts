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
import { PidginTranslator } from "../agent/pidgin-translator.js";
import { AgentUI } from "../agent/ui.js";
import { AgentFileSystem } from "../agent/file-system.js";
import { MemoryManager } from "../agent/types.js";

const DEFAULT_OPAL_ADK_ENDPOINT =
  "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/executeAgentNodeStream";

const NODE_AGENT_KEY = "node_agent";
const DEEP_RESEARCH_KEY = "deep_research";
const VALID_NODE_KEYS = [NODE_AGENT_KEY, DEEP_RESEARCH_KEY];

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

export { OpalAdkStream, NODE_AGENT_KEY, DEEP_RESEARCH_KEY }

export type PlanStep = {
  stepName: string;
  modelApi: string;
  inputParameters: string[];
  output?: string;
};

export interface BuildStreamingRequestBodyOptions {
  completedPrompt: LLMContent;
  modelConstraint?: string;
  uiType?: string;
  uiPrompt?: LLMContent;
  nodeApi?: string;
  invocationId?: string;
}

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

class OpalAdkStream {
  private readonly translator: PidginTranslator;
  private readonly fileSystem: AgentFileSystem;
  private readonly ui: AgentUI;
  private readonly memoryManager: MemoryManager;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.memoryManager = moduleArgs.agentContext.memoryManager;
    this.fileSystem = new AgentFileSystem({
      context: moduleArgs.context,
      memoryManager: this.memoryManager,
    });
    this.translator = new PidginTranslator(caps, moduleArgs, this.fileSystem);
    this.ui = new AgentUI(caps, moduleArgs, this.translator);
  }

  async getOpalAdkBackendUrl(caps: Capabilities) {
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

  toProtoModelConstraint(modelConstraint: ModelConstraint): string {
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

  toProtoUIType(uiType: string): string {
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

  buildStreamingRequestBody(options: BuildStreamingRequestBodyOptions): StreamingRequestBody {
    const {
      completedPrompt,
      modelConstraint,
      uiType,
      uiPrompt,
      nodeApi,
      invocationId,
    } = options;
    console.log("uiType: ", uiType);
    const contents: NonNullable<StreamingRequestBody["contents"]> = [];

    let textCount = 0;
    if (!completedPrompt.parts) {
      console.error("opal-adk-stream: Missing required prompt.")
    };
    for (const part of completedPrompt.parts) {
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

    const baseBody: StreamingRequestBody = {
      objective: completedPrompt,
      model_name: undefined,
      contents,
    };

    // 'node-agent' is specifically for agent mode while any other 
    // node will be for legacy execution.
    if (nodeApi && nodeApi !== NODE_AGENT_KEY) {
      baseBody.node_config = {
        node_api: nodeApi,
      };
    } else {
      baseBody.agent_mode_node_config = {};
      if (modelConstraint !== undefined) {
        baseBody.agent_mode_node_config.model_constraint = modelConstraint;
      }
      if (uiType !== undefined) {
        baseBody.agent_mode_node_config.ui_type = this.toProtoUIType(uiType);
      }
      if (uiPrompt !== undefined) {
        baseBody.agent_mode_node_config.ui_prompt = uiPrompt;
      }
    }

    if (invocationId !== undefined) {
      baseBody.invocation_id = invocationId
    }
  return baseBody;
}
 

  async executeOpalAdkStream(
    opalAdkAgent?: string,
    params?: LLMContent[],
    modelConstraint?: ModelConstraint,
    uiType?: string,
    uiPrompt?: LLMContent,
    invocationId?: string): Promise<Outcome<LLMContent>> {
    const ui = this.ui;

    if (!params || params.length === 0) {
      return err("opal-adk-stream: No params provided");
    } 
    if (modelConstraint === undefined) {
      modelConstraint = "none";
    }
    if (opalAdkAgent && !VALID_NODE_KEYS.includes(opalAdkAgent)) {
      const error = err(`opal-adk-stream: Invalid node key: ${opalAdkAgent}, ` +
        `valid keys are: ${ VALID_NODE_KEYS.join(", ") }`);
      console.error(error);
      return error;
    }
    ui.progress.startAgent(toLLMContent("Starting Opal ADK Agent."))
    try {
      const baseUrl = await this.getOpalAdkBackendUrl(this.caps);
      const url = new URL(baseUrl);
      url.searchParams.set("alt", "sse");
      const modelConstraintProtoString = (
        modelConstraint && this.toProtoModelConstraint(modelConstraint)
      ) || "MODEL_CONSTRAINT_UNSPECIFIED";
      const requestBody = this.buildStreamingRequestBody({
        completedPrompt: params[0],
        modelConstraint: modelConstraintProtoString,
        uiType,
        uiPrompt,
        nodeApi: opalAdkAgent,
        invocationId,
      });

      // Record model call with action tracker
      this.caps.write({
        path: `/ mnt / track / call_${ opalAdkAgent }` as FileSystemReadWritePath,
        data: [],
      });

      ui.progress.sendOpalAdkRequest(modelConstraintProtoString, requestBody)
      const response = await this.moduleArgs.fetchWithCreds(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: this.moduleArgs.context.signal,
      });

      console.log("response: ", response);
      if (!response.ok) {
        const errorText = await response.text();
        const error = err(`Streaming request failed: ${ response.status } ${ errorText }`);
        console.error(error);
        return error;
      }

      if (!response.body) {
        const error = err("No response body from streaming API");
        console.error(error);
        return error;
      }

      // Process the SSE stream
      let agentResult = "";
      let thoughtCount = 0;
      for await (const chunk of iteratorFromStream<StreamChunk>(response.body)) {
        console.log("chunk: ", chunk);
        const result = await this.parseStreamChunk(chunk, thoughtCount);
        if (result.thoughtCount !== undefined) {
          thoughtCount = result.thoughtCount;
        }
        if (result.agentResult) {
          agentResult += result.agentResult;
        }
        if (result.thought) {
          agentResult += result.thought;
        }
        if (result.error) {
          const error = err(result.error);
          console.error(error);
          return error;
        }
      }

      if (!agentResult) {
        const error = err("No agent result received from stream.");
        console.error(error);
        return error;
      }

      // Return HTML as inlineData with text/html mimeType to match legacy behavior
      return toLLMContent(agentResult, "model");
    } catch (e) {
      const error = err((e as Error).message);
      console.error(error);
      return error;
    } finally {
      ui.finish();
    }
  }

  /**
   * Parses a single stream chunk and updates the reporter and result variables.
   * Factored out for testability.
   */
  async parseStreamChunk(
    chunk: StreamChunk,
    thoughtCount: number
  ): Promise<{
    thoughtCount?: number;
    agentResult?: string;
    thought?: string;
    error?: string;
  }> {
    if (!chunk) return {};
    const ui = this.ui;
    const parts = chunk.parts || chunk.chunk?.parts;
    if (!parts) {
      console.warn("Received chunk without parts:", chunk);
      return {};
    }

    let agentResult: string | undefined;
    let thought: string | undefined;
    let currentThoughtCount = thoughtCount;
    let error: string | undefined;

    for (const part of parts) {
      const metadata = part.partMetadata || part.part_metadata;
      const type = metadata?.chunk_type;
      const text = part.text || "";
      if (type === "thought") {
        currentThoughtCount++;
        thought = (thought ? thought + "\n" : "") + text;
        ui.progress.thought(text);
      } else if (
        type === "result" ||
        type === "research" ||
        type === "breadboard" ||
        type === "html"
      ) {
        agentResult = (agentResult ? agentResult + "\n" : "") + text;
      } else if (type === "error") {
        console.error(err(text));
      } else {
        console.log(`Received unknown chunk type: ${ type }`);
      }
    }

    return {
      thoughtCount: currentThoughtCount,
      agentResult,
      thought,
      error,
    };
  }
}