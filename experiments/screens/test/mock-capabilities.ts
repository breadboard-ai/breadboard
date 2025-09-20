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
} from "../src/types.js";

export class MockCapabilities implements Capabilities {
  screens: ScreenServer;
  generate: Gemini;
  console: Console;
  mcp: McpClient;

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
          return this.cannedResponses[key];
        }
        throw new Error(`No canned response for request: ${key}`);
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
