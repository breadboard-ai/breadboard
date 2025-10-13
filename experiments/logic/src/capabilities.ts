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
  SchemaValidated,
} from "./types";

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
  #log: unknown[][] = [];
  #vfs = new Map<string, string>();

  constructor(private readonly apiKey: string) {}

  #logToConsole(...params: unknown[]) {
    this.#log = [...this.#log, params];
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
      const gemini = new GoogleGenAI({ apiKey: this.apiKey });
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
      throw new Error("Tool calling isn't yet implemented");
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
    get: (_id: string, _values?: Record<string, SchemaValidated>) => {
      throw new Error("Prompts aren't yet implemented");
    },
  };
}
