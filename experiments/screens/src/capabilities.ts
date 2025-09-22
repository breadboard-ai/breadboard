/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Content,
  ContentUnion,
  GoogleGenAI,
  Tool,
  ToolConfig,
} from "@google/genai";
import {
  Candidate,
  GetUserEventsResponse,
  UserEvent,
  Capabilities,
  GeminiInputs,
  CallToolRequest,
  ScreenInput,
  Prompt,
  SchemaValidated,
} from "./types";
import { screens, prompts } from "./apps/ai-slop-or-not";
import { TestHarness } from "./ui/test-harness";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

const promptMap = new Map<string, Prompt>(
  prompts.map((prompt) => [prompt.name, prompt])
);

class EventQueue {
  resolve: ((response: GetUserEventsResponse) => void) | null = null;
  queue: UserEvent[] = [];

  add(event: UserEvent) {
    this.queue.push(event);
    if (!this.resolve) return;
    const events = [...this.queue];
    this.queue.length = 0;
    const resolve = this.resolve;
    this.resolve = null;
    resolve({
      events,
      isError: false,
    });
  }

  async get(): Promise<GetUserEventsResponse> {
    if (this.queue.length === 0) {
      return new Promise<GetUserEventsResponse>((resolve) => {
        this.resolve = resolve;
      });
    }
    const events = [...this.queue];
    this.queue.length = 0;
    return {
      events,
      isError: false,
    };
  }
}

export class CapabilitiesImpl implements Capabilities {
  readonly eventQueue = new EventQueue();
  #testHarness: TestHarness | null = null;
  #log: unknown[][] = [];
  #vfs = new Map<string, string>();

  constructor() {
    document.body.addEventListener("user-event", (e) => {
      const event = (e as CustomEvent).detail;
      this.#log = [...this.#log, ["User event:", event]];
      this.eventQueue.add(event);
    });
  }

  #logToConsole(...params: unknown[]) {
    this.#log = [...this.#log, params];
    if (this.#testHarness) {
      this.#testHarness.log = this.#log;
    }
  }

  #processInlineData(candidates: Candidate[]): Candidate[] {
    return candidates.map((candidate) => {
      if (!candidate.content || !candidate.content.parts) {
        return candidate;
      }

      const parts = candidate.content.parts.map((part) => {
        if (!("inlineData" in part)) {
          return part;
        }

        const { mimeType, data } = part.inlineData;
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const vfsPath = `/vfs/out/${crypto.randomUUID()}`;
        this.#vfs.set(vfsPath, blobUrl);
        return {
          fileData: {
            fileUri: vfsPath,
            mimeType,
          },
        };
      });

      return { ...candidate, content: { ...candidate.content, parts } };
    });
  }

  generate = {
    generateContent: async (args: GeminiInputs) => {
      this.#logToConsole("Calling generateContent:", args);
      const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const result = await gemini.models.generateContent({
        model: args.model ?? "gemini-2.5-flash",
        contents: args.contents as Content,
        config: {
          tools: args.tools as Tool[],
          toolConfig: args.toolConfig as ToolConfig,
          responseSchema: args.generationConfig?.responseSchema,
          responseMimeType: args.generationConfig?.responseMimeType,
          systemInstruction: args.systemInstruction as ContentUnion,
          responseModalities: args.generationConfig?.responseModalities,
        },
      });
      this.#logToConsole("generateContent returned:", result);
      return {
        candidates: this.#processInlineData(result.candidates as Candidate[]),
      };
    },
  };
  mcp = {
    callTool: async (params: CallToolRequest) => {
      this.#logToConsole("Calling tool:", params);
      const { name, arguments: args } = params;
      switch (name) {
        case "screens_update_screens": {
          const screenInputs = args.screenInputs as ScreenInput[];
          if (!this.#testHarness) {
            this.#testHarness = document.querySelector("test-harness");
            if (this.#testHarness) {
              this.#testHarness.screens = screens;
              this.#testHarness.vfs = this.#vfs;
            }
          }

          if (!this.#testHarness) {
            return { isError: true };
          }

          this.#logToConsole(
            "Updating screens:",
            screenInputs.map((s) => s.screenId).join(", ")
          );

          const newStates = new Map(this.#testHarness.screenStates);
          const updatedScreens = new Set(this.#testHarness.updatedScreens);
          for (const screenInput of screenInputs) {
            const { screenId } = screenInput;
            newStates.set(screenId, screenInput);
            updatedScreens.add(screenId);
          }
          this.#testHarness.screenStates = newStates;
          this.#testHarness.updatedScreens = updatedScreens;

          return {
            isError: false,
          };
        }
        case "screens_get_user_events": {
          const eventsResponse = await this.eventQueue.get();
          const { events, isError } = eventsResponse;
          return { isError, response: { events } };
        }
        default: {
          this.#logToConsole("Unknown tool", name);
          throw new Error(`Unknown tool "${name}"`);
        }
      }
    },
  };
  console = {
    log: (...params: unknown[]) => {
      this.#logToConsole(...params);
    },
    error: (...params: unknown[]) => {
      this.#logToConsole("ERROR:", ...params);
    },
  };
  prompts: Capabilities["prompts"] = {
    get: (id: string, values?: Record<string, SchemaValidated>) => {
      const prompt = promptMap.get(id);
      if (!prompt) {
        throw new Error(`Prompt with id "${id}" not found`);
      }

      if (!values) {
        return Promise.resolve(prompt);
      }

      const replacer = (
        value: string,
        substitutions: Record<string, unknown>
      ) => {
        return value.replace(/{{(.*?)}}/g, (match, key) => {
          const parts = key.trim().split(".");
          let sub: unknown = substitutions;
          for (const part of parts) {
            if (typeof sub !== "object" || sub === null) {
              return match;
            }
            sub = (sub as Record<string, unknown>)[part];
          }
          return sub !== undefined ? String(sub) : match;
        });
      };

      const value = replacer(prompt.value, values);
      return Promise.resolve({ ...prompt, value });
    },
  };
}
