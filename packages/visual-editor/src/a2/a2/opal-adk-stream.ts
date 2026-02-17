export type { StreamingRequestBody, StreamChunk };

import {
  LLMContent,
  OPAL_BACKEND_API_PREFIX,
  Outcome,
} from "@breadboard-ai/types";
import { err, toLLMContent } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { iteratorFromStream } from "@breadboard-ai/utils";
import { PidginTranslator } from "../agent/pidgin-translator.js";
import { AgentUI } from "../agent/ui.js";
import { AgentFileSystem } from "../agent/file-system.js";
import { MemoryManager } from "../agent/types.js";

const OPAL_ADK_ENDPOINT = new URL(
  "v1beta1/executeAgentNodeStream",
  OPAL_BACKEND_API_PREFIX
).href;

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

export { OpalAdkStream, NODE_AGENT_KEY, DEEP_RESEARCH_KEY };

export type PlanStep = {
  stepName: string;
  modelApi: string;
  inputParameters: string[];
  output?: string;
};

export interface BuildStreamingRequestBodyOptions {
  completedPrompt: LLMContent;
  executionInputs?: LLMContent[];
  modelConstraint?: string;
  uiType?: string;
  uiPrompt?: LLMContent;
  nodeApi?: string;
  invocationId?: string;
  sessionId?: string;
}

type StreamingRequestPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
  file_data?: {
    mime_type: string;
    file_uri: string;
  };
};

type StreamingRequestBody = {
  session_id?: string;
  objective?: LLMContent;
  invocation_id?: string;
  execution_inputs?: Record<string, {
    parts: StreamingRequestPart[];
    role: string;
  }>;
  node_config?: {
    node_api?: string;
  };
  agent_mode_node_config?: {
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
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.memoryManager = moduleArgs.agentContext.memoryManager;
    this.fileSystem = new AgentFileSystem({
      context: moduleArgs.context,
      memoryManager: this.memoryManager,
    });
    this.translator = new PidginTranslator(moduleArgs, this.fileSystem);
    this.ui = new AgentUI(moduleArgs, this.translator);
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

  buildStreamingRequestBody(options: BuildStreamingRequestBodyOptions): Outcome<StreamingRequestBody> {
    const {
      completedPrompt,
      executionInputs,
      uiType,
      uiPrompt,
      nodeApi,
      invocationId,
      sessionId,
    } = options;
    const execution_inputs: NonNullable<StreamingRequestBody["execution_inputs"]> = {};
    let inputCount = 0;
    if (!completedPrompt.parts) {
      const error = err("opal-adk-stream: Missing required prompt.");
      console.error(error);
      return error;
    };
    if (executionInputs) {
      for (const content of executionInputs) {
        if (!content.parts) {
          const error = err("opal-adk-stream: Execution input has no parts.");
          console.error(error);
          return error;
        }
        if (content.parts.length > 1) {
          const error = err("opal-adk-stream: Execution input has multiple part.");
          console.error(error);
          return error;
        }
        const part = content.parts[0];
        inputCount++;
        let inputName = "";
        const requestPart: StreamingRequestPart = {};

        if ("text" in part) {
          inputName = "input_text";
          requestPart.text = part.text;
        } else if ("inlineData" in part) {
          const mime_type = part.inlineData.mimeType;
          if (mime_type.startsWith("image/")) {
            inputName = "input_image";
          } else if (mime_type.startsWith("audio/")) {
            inputName = "input_audio";
          } else if (mime_type.startsWith("video/")) {
            inputName = "input_video";
          } else {
            inputName = "input_data";
          }
          requestPart.inline_data = {
            mime_type: part.inlineData.mimeType,
            data: part.inlineData.data,
          };
        } else if ("fileData" in part) {
          inputName = "input_file";
          requestPart.file_data = {
            mime_type: part.fileData.mimeType,
            file_uri: part.fileData.fileUri,
          };
        } else {
          continue;
        }

        execution_inputs[inputName] = {
          parts: [requestPart],
          role: "user",
        };
      }
    }

    const baseBody: StreamingRequestBody = {
      objective: completedPrompt,
      execution_inputs,
    };

    // 'node-agent' is specifically for agent mode while any other
    // node will be for legacy execution.
    if (nodeApi && nodeApi !== NODE_AGENT_KEY) {
      baseBody.node_config = {
        node_api: nodeApi,
      };
    } else {
      baseBody.agent_mode_node_config = {};
      if (uiType !== undefined) {
        baseBody.agent_mode_node_config.ui_type = this.toProtoUIType(uiType);
      }
      if (uiPrompt !== undefined) {
        baseBody.agent_mode_node_config.ui_prompt = uiPrompt;
      }
    }

    if (sessionId !== undefined) {
      baseBody.session_id = sessionId;
    }

    if (invocationId !== undefined) {
      baseBody.invocation_id = invocationId;
    }
    return baseBody;
  }

  async executeOpalAdkStream(
    objective: LLMContent,
    opalAdkAgent?: string,
    params?: LLMContent[],
    uiType?: string,
    uiPrompt?: LLMContent,
    invocationId?: string,
    sessionId?: string
  ): Promise<Outcome<LLMContent>> {
    const ui = this.ui;

    if (opalAdkAgent && !VALID_NODE_KEYS.includes(opalAdkAgent)) {
      const error = err(`opal-adk-stream: Invalid node key: ${opalAdkAgent}, ` +
        `valid keys are: ${VALID_NODE_KEYS.join(", ")}`);
      console.error(error);
      return error;
    }
    ui.progress.startAgent(toLLMContent("Starting Opal ADK Agent."));
    try {
      const baseUrl = OPAL_ADK_ENDPOINT;
      const url = new URL(baseUrl);
      url.searchParams.set("alt", "sse");
      const requestBodyOrError = this.buildStreamingRequestBody({
        completedPrompt: objective,
        executionInputs: params,
        uiType,
        uiPrompt,
        nodeApi: opalAdkAgent,
        invocationId,
        sessionId,
      });

      if (!ok(requestBodyOrError)) {
        return requestBodyOrError;
      }
      const requestBody = requestBodyOrError;
      ui.progress.sendOpalAdkRequest("", requestBody)
      const response = await this.moduleArgs.fetchWithCreds(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: this.moduleArgs.context.signal,
      });

      console.log("response: ", response);
      if (!response.ok) {
        const errorText = await response.text();
        const error = err(`Streaming request failed: ${response.status} ${errorText}`);
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
      for await (const chunk of iteratorFromStream<StreamChunk>(
        response.body
      )) {
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
        console.log(`Received unknown chunk type: ${type}`);
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
