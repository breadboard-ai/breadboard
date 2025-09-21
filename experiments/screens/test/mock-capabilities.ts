import {
  Capabilities,
  ScreenServer,
  Gemini,
  ScreenInput,
  GetUserEventsResponse,
  GeminiInputs,
  GeminiOutputs,
  LLMContent,
  UserEvent,
  McpClient,
  Prompt,
  SchemaValidated,
} from "../src/types.js";
import { prompts } from "../src/apps/adventure-game.js";
import { replacer } from "./adventure-game.test.js";

const promptMap = new Map<string, Prompt>(
  prompts.map((prompt) => [prompt.id, prompt])
);

export class MockCapabilities implements Capabilities {
  screens: ScreenServer;
  generate: Gemini;
  console: Console;
  mcp: McpClient;
  prompts: Capabilities["prompts"];

  private screenHistory: ScreenInput[][] = [];
  private eventQueue: UserEvent[][] = [];
  private cannedResponses: Record<string, GeminiOutputs> = {};
  private pendingResolve:
    | ((value: GetUserEventsResponse) => void)
    | null = null;
  private pendingReject: ((reason?: Error) => void) | null = null;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.screens = {
      updateScreens: async (screens: ScreenInput[]) => {
        this.screenHistory.push(screens);
        return { isError: false };
      },
      getUserEvents: async (): Promise<GetUserEventsResponse> => {
        return new Promise((resolve, reject) => {
          this.pendingResolve = resolve;
          this.pendingReject = reject;
          const checkQueue = () => {
            if (this.eventQueue.length > 0) {
              const events = this.eventQueue.shift() || [];
              this.pendingResolve = null;
              this.pendingReject = null;
              resolve({ events, isError: false });
            } else {
              this.timeoutId = setTimeout(checkQueue, 10);
            }
          };
          checkQueue();
        });
      },
    };

    this.generate = {
      generateContent: async (
        request: GeminiInputs
      ): Promise<GeminiOutputs> => {
        const key = JSON.stringify(request.contents);
        if (this.cannedResponses[key]) {
          const response = this.cannedResponses[key];
          // Simulate the VFS processing of inlineData.
          if (response.candidates) {
            response.candidates = response.candidates.map((candidate) => {
              if (candidate.content && candidate.content.parts) {
                candidate.content.parts = candidate.content.parts.map(
                  (part) => {
                    if ("inlineData" in part) {
                      return {
                        fileData: {
                          mimeType: part.inlineData.mimeType,
                          fileUri: `/vfs/out/mock-${Math.random()
                            .toString(36)
                            .substring(2)}`,
                        },
                      };
                    }
                    return part;
                  }
                );
              }
              return candidate;
            });
          }
          return response;
        }
        throw new Error(`No canned response for request: ${key}`);
      },
    };

    this.prompts = {
      get: async (id, values) => {
        const prompt = promptMap.get(id);
        if (!prompt) {
          throw new Error(`Prompt with id "${id}" not found`);
        }

        if (!values) {
          return prompt;
        }

        const value = replacer(prompt.value, values);
        return { ...prompt, value };
      },
    };

    this.console = console;
    this.mcp = {
      callTool: async () => {
        throw new Error("not implemented");
      },
    };
  }

  // Test methods
  injectEvents(events: UserEvent[]) {
    this.eventQueue.push(events);
    if (this.pendingResolve) {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      const events = this.eventQueue.shift() || [];
      this.pendingResolve({ events, isError: false });
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }

  cannedResponse(request: LLMContent[], response: GeminiOutputs) {
    this.cannedResponses[JSON.stringify(request)] = response;
  }

  getScreenHistory() {
    return this.screenHistory;
  }

  destroy() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.pendingReject) {
      this.pendingReject(new Error("Test finished"));
    }
  }
}
