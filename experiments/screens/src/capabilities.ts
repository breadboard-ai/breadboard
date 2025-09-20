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
} from "./types";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;

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

  generate = {
    async generateContent(args: GeminiInputs) {
      const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const result = await gemini.models.generateContent({
        model: args.model ?? "gemini-2.5-flash",
        contents: args.contents as Content,
      });
      return { candidates: result.candidates as Candidate[] };
    },
  };
  mcp = {
    async callTool(params: CallToolRequest) {
      console.log("CALL TOOL", params);
      throw new Error("Not implemented");
    },
  };
  console = {
    log(...params: unknown[]) {
      console.log(...params);
    },
    error(...params: unknown[]) {
      console.error(...params);
    },
  };
  screens = {
    getUserEvents: () => this.eventQueue.get(),
    async updateScreens(screenInputs: ScreenInput[]) {
      console.log("UPDATE SCREENS", screenInputs);
      return {
        isError: false,
      };
    },
  };
}
