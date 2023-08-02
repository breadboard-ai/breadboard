/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateMessageRequest, MessagePrompt } from "./types.js";

/**
 * A partical `GenerateMessageRequest` interface, for use with the `Chat` builder.
 * It's basically the same as `GenerateMessageRequest`, except that `prompt` is optional.
 */
export interface PartialGenerateMessageRequest
  extends Omit<GenerateMessageRequest, "prompt"> {
  prompt?: MessagePrompt;
}

/**
 * A convenience builder for chat-like requests.
 *
 * Implements `GenerateMessageRequest` interface.
 *
 * Example:
 *
 * ```typescript
 * const chat = new Chat();
 * chat.addMessage("Hello there!");
 * const data = await fetch(palm(PALM_KEY).message(chat));
 * const response = await data.json();
 * ```
 */
export class Chat implements GenerateMessageRequest {
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  prompt: MessagePrompt = { messages: [] };

  /**
   * Creates a new instance of a `GenerateMessageRequest` builder. You can pass this instance directly into `palm().message()`. The builder follows the typical pattern of builder classes, where you can chain methods together to build the request, like so:
   * 
   * ```typescript
   * const chat = new Chat();
   * chat
   *  .addMessage("Hello there!").
   *  .addExample({
        input: "Pull up! All craft pull up!",
        output: "It's a trap!",
   *  });
   * const data = await fetch(palm(PALM_KEY).message(chat));
   * const response = await data.json();
   * ```
   * @param request A partial request object. Just put things like `temperature` and `candidateCount` into it and they will be used in the built instance.
   */
  constructor(request?: PartialGenerateMessageRequest) {
    Object.assign(this, request);
  }

  /**
   * Helper for setting the `context` property of the prompt.
   * @param context Text that should be provided to the model first to ground the response.
   * @returns The builder instance.
   */
  context(context: string) {
    this.prompt.context = context;
    return this;
  }

  /**
   * Helper for adding an example to the prompt.
   * @param example The example of what the model should generate, in the format of `{ input: string, output: string }`.
   * @returns The builder instance.
   */
  addExample({ input, output }: { input: string; output: string }) {
    if (!this.prompt.examples) this.prompt.examples = [];
    this.prompt.examples.push({
      input: { content: input },
      output: { content: output },
    });
    return this;
  }

  /**
   * Helper for adding to the snapshot of recent conversation history for the prompt. This is what you would typically use to start the conversation and help the model keep traack of it.
   * @param message The message to add to the history of messages.
   * @returns The builder instance.
   */
  addMessage(message: string) {
    this.prompt?.messages?.push({ content: message });
    return this;
  }
}
