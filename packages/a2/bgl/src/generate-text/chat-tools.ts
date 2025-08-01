/**
 * @fileoverview Tools for conversational ("chat") mode
 */

import type { FunctionDeclaration } from "../a2/gemini";
import type { ToolHandle } from "../a2/tool-manager";

export type ChatTool = {
  readonly name: string;
  handle(): ToolHandle;
  reset(): void;
  readonly invoked: boolean;
};

export { createDoneTool, createKeepChattingResult, createKeepChattingTool };

function createKeepChattingResult() {
  return {
    parts: [{ functionCall: { name: "User_Asks_For_More_Work", args: {} } }],
    role: "model",
  };
}

class ChatToolImpl implements ChatTool {
  #invoked = false;

  constructor(
    public readonly name: string,
    public readonly description: string
  ) {}

  reset() {
    this.#invoked = false;
  }

  get invoked() {
    return this.#invoked;
  }

  declaration() {
    return {
      name: this.name,
      description: this.description,
      parameters: { type: "object" },
    } as FunctionDeclaration;
  }

  handle(): ToolHandle {
    return {
      tool: this.declaration(),
      url: "",
      passContext: false,
      invoke: async () => {
        this.#invoked = true;
      },
    };
  }
}

function createDoneTool(): ChatTool {
  return new ChatToolImpl(
    "User_Says_Done",
    "Call when the user indicates they are done with the conversation and are ready to move on"
  );
}

function createKeepChattingTool(): ChatTool {
  return new ChatToolImpl(
    "User_Asks_For_More_Work",
    "Call when the user asked a question or issued instruction to do more work"
  );
}
