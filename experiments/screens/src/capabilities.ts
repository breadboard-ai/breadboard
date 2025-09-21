/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, GoogleGenAI } from "@google/genai";
import {
  Candidate,
  GetUserEventsResponse,
  UserEvent,
  Capabilities,
  GeminiInputs,
  CallToolRequest,
  ScreenInput,
  Screen,
} from "./types";
import { screens } from "./apps/adventure-game";
import { TestHarness } from "./ui/test-harness";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

const screenMap = new Map<string, Screen>(
  screens.map((screen) => [screen.screenId, screen])
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

  generate = {
    generateContent: async (args: GeminiInputs) => {
      this.#logToConsole("Calling generateContent:", args);
      const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const result = await gemini.models.generateContent({
        model: args.model ?? "gemini-2.5-flash",
        contents: args.contents as Content,
      });
      this.#logToConsole("generateContent returned:", result);
      return { candidates: result.candidates as Candidate[] };
    },
  };
  mcp = {
    callTool: async (params: CallToolRequest) => {
      this.#logToConsole("Calling tool:", params);
      throw new Error("Not implemented");
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
  get screens() {
    return {
      getUserEvents: () => this.eventQueue.get(),
      updateScreens: async (screenInputs: ScreenInput[]) => {
        if (!this.#testHarness) {
          this.#testHarness = document.querySelector("test-harness");
          if (this.#testHarness) {
            this.#testHarness.screens = screens;
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
        for (const screenInput of screenInputs) {
          newStates.set(screenInput.screenId, screenInput);
        }
        this.#testHarness.screenStates = newStates;

        return {
          isError: false,
        };
      },
    };
  }
}
