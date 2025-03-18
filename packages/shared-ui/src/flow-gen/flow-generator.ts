/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import type {
  AppCatalystApiClient,
  AppCatalystChatRequest,
} from "./app-catalyst.js";

export interface OneShotFlowGenRequest {
  intent: string;
  context?: {
    flow?: GraphDescriptor;
  };
}

export interface OneShotFlowGenResponse {
  flow: GraphDescriptor;
}

export class FlowGenerator {
  #appCatalystApiClient: AppCatalystApiClient;

  constructor(appCatalystApiClient: AppCatalystApiClient) {
    this.#appCatalystApiClient = appCatalystApiClient;
  }

  async oneShot({
    intent,
    context,
  }: OneShotFlowGenRequest): Promise<OneShotFlowGenResponse> {
    const request: AppCatalystChatRequest = {
      messages: [
        {
          mimetype: "text/plain",
          data: btoa(intent),
        },
      ],
      appOptions: {
        format: "FORMAT_GEMINI_FLOWS",
      },
    };
    if (context?.flow) {
      request.messages.push({
        mimetype: "text/breadboard",
        data: btoa(JSON.stringify(context.flow)),
      });
    }

    const { messages } = await this.#appCatalystApiClient.chat(request);
    if (messages.length < 3) {
      throw new Error(
        `Expected response to have at least 3 messages, got ${messages.length}.`
      );
    }
    const responseFlows: GraphDescriptor[] = [];
    const responseMessages: string[] = [];
    for (
      let i = /* Skip our own messages */ request.messages.length;
      i < messages.length;
      i++
    ) {
      const message = messages[i];
      if (message.mimetype === "text/breadboard") {
        responseFlows.push(JSON.parse(atob(message.data)));
      } else if (message.mimetype === "text/plain") {
        responseMessages.push(atob(message.data));
      }
    }
    const generatedFlow = responseFlows.at(-1);
    if (!generatedFlow) {
      // If the backend can't make a flow, it will usually return some text
      // explaining why.
      const probableErrorMessage = responseMessages.join("\n\n");
      if (probableErrorMessage) {
        throw new Error(`No flow was generated: ${probableErrorMessage}`);
      }
      throw new Error(
        `Expected a new flow and/or an error message,` +
          ` got ${JSON.stringify(messages)}.`
      );
    }
    return { flow: generatedFlow };
  }
}
