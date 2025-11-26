/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  LLMContent,
} from "@breadboard-ai/types";
import type {
  AppCatalystApiClient,
  AppCatalystChatRequest,
  AppCatalystContentChunk,
} from "./app-catalyst.js";
import {
  isLLMContent,
  isTextCapabilityPart,
  Template,
} from "@google-labs/breadboard";
import { createContext } from "@lit/context";

export interface OneShotFlowGenRequest {
  intent: string;
  context?: {
    flow?: GraphDescriptor;
  };
  constraint?: FlowGenConstraint;
}

export type OneShotFlowGenResponse =
  | OneShotFlowGenSuccessResponse
  | OneShotFlowGenFailureResponse;

export type OneShotFlowGenSuccessResponse = {
  flow: GraphDescriptor;
};

export type OneShotFlowGenFailureResponse = {
  error: string;
  suggestedIntent?: string;
};

export type FlowGenConstraint = EditStepFlowGenConstraint;

export type EditStepFlowGenConstraint = {
  kind: "EDIT_STEP_CONFIG";
  stepId: string;
};

export const flowGeneratorContext = createContext<FlowGenerator | undefined>(
  "FlowGenerator"
);

export class FlowGenerator {
  #appCatalystApiClient: AppCatalystApiClient;
  #agentMode: boolean;
  #streamPlanner: boolean;

  constructor(
    appCatalystApiClient: AppCatalystApiClient,
    agentMode = false,
    streamPlanner = false
  ) {
    this.#appCatalystApiClient = appCatalystApiClient;
    this.#agentMode = agentMode;
    this.#streamPlanner = streamPlanner;
  }

  async oneShot({
    intent,
    context,
    constraint,
  }: OneShotFlowGenRequest): Promise<OneShotFlowGenResponse> {
    if (constraint && !context?.flow) {
      throw new Error(
        `Error editing flow with constraint ${constraint.kind}:` +
          ` An original flow was not provided.`
      );
    }
    if (intent.startsWith("/force error ")) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      throw new Error(intent.slice("/force error ".length));
    }
    const request: AppCatalystChatRequest = {
      messages: [
        {
          mimetype: "text/plain",
          data: btoa(unescape(encodeURIComponent(intent))),
        },
      ],
      appOptions: {
        format: "FORMAT_GEMINI_FLOWS",
        ...(this.#agentMode && { featureFlags: { enable_agent_mode_planner: true } }),
      },
    };
    // Check to see if there's an existing flow with nodes and if so,
    // add it to the input. Otherwise, presume that this is a brand new flow.
    if (context?.flow && context.flow.nodes.length > 0) {
      const stringifiedFlow = JSON.stringify(context.flow);
      request.messages.push({
        mimetype: "text/breadboard",
        data: btoa(unescape(encodeURIComponent(stringifiedFlow))),
      });
    }
    if (constraint) {
      request.messages.push({
        mimetype: "text/plain",
        data: btoa(
          unescape(
            encodeURIComponent(
              this.#promptForConstraint(constraint, context!.flow!)
            )
          )
        ),
      });
    }

    const responseFlows: GraphDescriptor[] = [];
    const responseMessages: string[] = [];
    const suggestions: string[] = [];

    if (this.#streamPlanner && !constraint) {
      await this.#streamOneShot(
        intent,
        context,
        responseFlows,
        responseMessages,
        suggestions
      );
    } else {
      await this.#blockOneShot(
        request,
        responseFlows,
        responseMessages,
        suggestions
      );
    }

    const generatedFlow = responseFlows.at(-1);
    if (!generatedFlow) {
      // If the backend can't make a flow, it will usually return some text
      // explaining why.
      const probableErrorMessage = responseMessages.join("\n\n");
      if (probableErrorMessage) {
        return {
          error: probableErrorMessage,
          suggestedIntent:
            suggestions.length === 0 ? undefined : suggestions.join("\n"),
        };
      }
      throw new Error(
        `Unexpected error: backend did not return a response. Please try again.`
      );
    }

    if (constraint) {
      return {
        flow: this.#applyConstraint(constraint, context!.flow!, generatedFlow),
      };
    }
    return { flow: generatedFlow };
  }

  async #streamOneShot(
    intent: string,
    context: OneShotFlowGenRequest["context"],
    responseFlows: GraphDescriptor[],
    responseMessages: string[],
    suggestions: string[]
  ) {
    let stream: AsyncGenerator<LLMContent>;
    if (context?.flow && context.flow.nodes.length > 0) {
      stream = this.#appCatalystApiClient.editOpalStream(
        intent,
        context.flow,
        this.#agentMode
      );
    } else {
      stream = this.#appCatalystApiClient.generateOpalStream(
        intent,
        this.#agentMode
      );
    }

    for await (const chunk of stream) {
      for (const part of chunk.parts) {
        this.#processStreamPart(
          part,
          responseFlows,
          responseMessages,
          suggestions
        );
      }
    }
  }

  #processStreamPart(
    part: any,
    responseFlows: GraphDescriptor[],
    responseMessages: string[],
    suggestions: string[]
  ) {
    const partWithMetadata = part as any;
    const type = partWithMetadata.partMetadata?.chunk_type;
    if ("text" in part) {
      const isThought = type === "thought";
      const isStatus = type === "planning_status";

      if (isThought) {
        console.log(`[flowgen] Thought: ${part.text}`);
      } else if (isStatus) {
        console.log(`[flowgen] Status: ${part.text}`);
      } else if (type === "breadboard") {
        try {
          responseFlows.push(JSON.parse(part.text));
        } catch (e) {
          console.warn("Failed to parse breadboard chunk from text", e);
          responseMessages.push(part.text);
        }
      } else if (type === "rewritten") {
        suggestions.push(part.text);
      } else {
        responseMessages.push(part.text);
      }
    }
  }

  async #blockOneShot(
    request: AppCatalystChatRequest,
    responseFlows: GraphDescriptor[],
    responseMessages: string[],
    suggestions: string[]
  ) {
    const { messages } = await this.#appCatalystApiClient.chat(request);
    console.log(
      `[flowgen] AppCatalyst responses:`,
      ...messages.map((message) => ({ ...message, data: atob(message.data) }))
    );
    for (
      let i = /* Skip our own messages */ request.messages.length;
      i < messages.length;
      i++
    ) {
      this.#processBlockResponse(
        messages[i],
        responseFlows,
        responseMessages,
        suggestions
      );
    }
  }

  #processBlockResponse(
    message: AppCatalystContentChunk,
    responseFlows: GraphDescriptor[],
    responseMessages: string[],
    suggestions: string[]
  ) {
    const decodedData = atob(message.data);
    if (message.mimetype === "text/breadboard") {
      responseFlows.push(JSON.parse(decodedData));
    } else if (message.mimetype === "text/plain") {
      responseMessages.push(decodedData);
    } else if (message.mimetype === "text/rewritten") {
      suggestions.push(decodedData);
    }
  }

  #promptForConstraint(
    constraint: FlowGenConstraint,
    originalFlow: GraphDescriptor
  ) {
    switch (constraint.kind) {
      case "EDIT_STEP_CONFIG": {
        const originalStep = findStepById(originalFlow, constraint.stepId);
        if (!originalStep) {
          throw new Error(
            `Error creating prompt for ${constraint.kind} constraint:` +
              ` An original step was not found` +
              ` with ID ${JSON.stringify(constraint.stepId)}.`
          );
        }
        const title = originalStep?.metadata?.title;
        if (!title) {
          throw new Error(
            `Error creating prompt for ${constraint.kind} constraint:` +
              ` Original step did not have a title` +
              ` with ID ${JSON.stringify(constraint.stepId)}.`
          );
        }
        // Note: this string is a magic contract with the backend planner.
        return `IMPORTANT: You MUST edit the configuration ONLY for Step "${title}".`;
      }
      default: {
        constraint.kind satisfies never;
        throw new Error(`Unexpected constraint: ${JSON.stringify(constraint)}`);
      }
    }
  }

  #applyConstraint(
    constraint: FlowGenConstraint,
    originalFlow: GraphDescriptor,
    generatedFlow: GraphDescriptor
  ): GraphDescriptor {
    switch (constraint.kind) {
      case "EDIT_STEP_CONFIG": {
        const originalStepId = constraint.stepId;
        const originalFlowClone = structuredClone(originalFlow);
        const originalStepClone = findStepById(
          originalFlowClone,
          originalStepId
        );
        // The error states below should no longer be possible, but we keep
        // in the case of misbehaving backend.
        if (!originalStepClone) {
          throw new Error(
            `Error applying ${constraint.kind} constraint to flow:` +
              ` An original step was not found` +
              ` with id ${JSON.stringify(originalStepId)}.`
          );
        }
        const originalTitle = originalStepClone.metadata?.title;
        const generatedStep =
          // Prefer to reconcile by ID, then title.
          findStepById(generatedFlow, originalStepId) ??
          (originalTitle
            ? findStepByTitle(generatedFlow, originalTitle)
            : undefined);
        if (!generatedStep) {
          throw new Error(
            `Error applying ${constraint.kind} constraint to flow:` +
              ` A generated step was not found` +
              ` with id ${JSON.stringify(originalStepId)}` +
              ` nor title ${JSON.stringify(originalTitle)}.`
          );
        }
        const originalConfig = originalStepClone.configuration;
        const generatedConfig = structuredClone(generatedStep.configuration);
        if (originalConfig && generatedConfig) {
          reconcileInputReferences(originalConfig, generatedConfig);
        }
        console.log(
          "[flowgen] Configuration updated from",
          originalConfig,
          "to",
          generatedConfig
        );
        originalStepClone.configuration = generatedConfig;
        return originalFlowClone;
      }
      default: {
        constraint.kind satisfies never;
        throw new Error(`Unexpected constraint: ${JSON.stringify(constraint)}`);
      }
    }
  }
}

function findStepById(
  flow: GraphDescriptor,
  stepId: string
): NodeDescriptor | undefined {
  return (flow?.nodes ?? []).find((step) => step.id === stepId);
}

function findStepByTitle(
  flow: GraphDescriptor,
  stepTitle: string
): NodeDescriptor | undefined {
  return (flow?.nodes ?? []).find((step) => step.metadata?.title === stepTitle);
}

/**
 * Align the "paths" (incoming node IDs) of all "@" input references in
 * `newConfig` with those from `oldConfig`. We prefer aligning by ID, then
 * title. Failing either, the path is left unchanged.
 *
 * Note this does an in-place update of `generatedConfig`.
 */
function reconcileInputReferences(
  originalConfig: NodeConfiguration,
  generatedConfig: NodeConfiguration
): void {
  const originalPaths = new Set<string>();
  const originalTitleToPath = new Map<string, string>();
  for (const content of Object.values(originalConfig)) {
    if (isLLMContent(content)) {
      for (const part of content.parts) {
        if (isTextCapabilityPart(part)) {
          const template = new Template(part.text);
          for (const { title, path } of template.placeholders) {
            originalPaths.add(path);
            originalTitleToPath.set(title, path);
          }
        }
      }
    }
  }
  for (const content of Object.values(generatedConfig)) {
    if (isLLMContent(content)) {
      for (const part of content.parts) {
        if (isTextCapabilityPart(part)) {
          const template = new Template(part.text);
          const withPathsSubstituted = template.transform((part) => ({
            ...part,
            path: originalPaths.has(part.path)
              ? part.path
              : (originalTitleToPath.get(part.title) ?? part.path),
          }));
          part.text = withPathsSubstituted;
        }
      }
    }
  }
}
