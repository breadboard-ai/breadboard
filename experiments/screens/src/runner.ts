/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

// import { screens } from "./apps/adventure-game";
import adventureGame from "../out/adventure-game";
import { Content, GoogleGenAI } from "@google/genai";
import { Candidate, GetUserEventsResponse, Invoke, UserEvent } from "./types";

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

async function run(app: Invoke) {
  const eventQueue = new EventQueue();
  app({
    generate: {
      async generateContent(args) {
        const gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
        const result = await gemini.models.generateContent({
          model: args.model ?? "gemini-2.5-flash",
          contents: args.contents as Content,
        });
        return { candidates: result.candidates as Candidate[] };
      },
    },
    mcp: {
      async callTool(params) {
        console.log("CALL TOOL", params);
        throw new Error("Not implemented");
      },
    },
    console: {
      log(...params) {
        console.log(...params);
      },
      error(...params) {
        console.error(...params);
      },
    },
    screens: {
      async getUserEvents() {
        return eventQueue.get();
      },
      async updateScreens(screenInputs) {
        console.log("UPDATE SCREENS", screenInputs);
        return {
          isError: false,
        };
      },
    },
  });
  eventQueue.add({
    screenId: "start_game",
    eventId: "generate_inspiration",
  });
}

run(adventureGame as unknown as Invoke);
