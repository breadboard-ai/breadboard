/**
 * @fileoverview Tools for conversational ("chat") mode
 */

import type { ToolHandle } from "./a2/tool-manager";

export { createDoneTool, createKeepChattingTool };

class ChatTool {
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
    };
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

function createDoneTool() {
  return new ChatTool(
    "User_Says_Done",
    "Call when the user indicates they are done with the conversation and are ready to move on"
  );
}

function createKeepChattingTool() {
  return new ChatTool(
    "User_Asks_For_More_Work",
    "Call when the user asked a question or issued instruction to do more work"
  );
}
