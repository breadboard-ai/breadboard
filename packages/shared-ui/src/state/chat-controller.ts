/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphStartProbeData, OutputValues } from "@breadboard-ai/types";
import { GraphStoreEntry, MutableGraphStore } from "@google-labs/breadboard";
import {
  HarnessRunner,
  RunErrorEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeStartEvent,
  RunOutputEvent,
} from "@google-labs/breadboard/harness";
import { ChatConversationState, ChatState, ChatStatus } from "./types";

export { ChatController };

class ChatController {
  #status: ChatStatus = "stopped";
  #conversation: ChatConversationState[] = [];
  #state: ChatState = this.#initialChatState();
  #stale: boolean = false;
  #currentInput: RunInputEvent | null = null;
  #graphStack: GraphStartProbeData[] = [];

  constructor(
    public readonly runner: HarnessRunner | null,
    public readonly graphStore: MutableGraphStore | null
  ) {
    if (!runner) return;

    runner.addEventListener("abort", () => {
      this.#currentInput = null;
      this.#status = "stopped";
    });
    runner.addEventListener("start", () => {
      this.#status = "running";
    });
    runner.addEventListener("pause", () => {
      this.#status = "paused";
    });
    runner.addEventListener("resume", (event) => {
      this.#finalizeInput(event.data.inputs || {});
      this.#status = "running";
    });
    runner.addEventListener("end", () => {
      this.#status = "stopped";
    });
    runner.addEventListener("graphstart", this.#onGraphstart.bind(this));
    runner.addEventListener("graphend", this.#onGraphend.bind(this));
    runner.addEventListener("input", this.#onInput.bind(this));
    runner.addEventListener("output", this.#onOutput.bind(this));
    runner.addEventListener("error", this.#onError.bind(this));
  }

  state(): ChatState {
    this.#refreshChatState();
    return this.#state;
  }

  #initialChatState(): ChatState {
    return {
      session: {
        conversation: [],
        status: "stopped",
      },
    };
  }

  #refreshChatState() {
    if (!this.#stale) return;

    this.#state = {
      session: {
        conversation: this.#conversation,
        status: this.#status,
      },
    };
    this.#stale = false;
  }

  #finalizeInput(inputs: OutputValues) {
    if (!this.#currentInput) return;

    console.log(
      "ADDING INPUT",
      inputs,
      this.#currentInput,
      this.#currentGraph()
    );
    this.#appendTurn({
      role: "user",
      content: [{ title: "input", text: JSON.stringify(inputs) }],
    });

    this.#currentInput = null;
  }

  #onGraphstart(event: RunGraphStartEvent) {
    this.#graphStack.unshift(event.data);
  }

  #onGraphend() {
    this.#graphStack.shift();
  }

  #onInput(event: RunInputEvent) {
    this.#currentInput = event;
  }

  #appendTurn(turn: ChatConversationState) {
    this.#stale = true;
    this.#conversation = [...this.#conversation, turn];
  }

  #onOutput(event: RunOutputEvent) {
    console.log("ADDING OUTPUT", event, this.#currentGraph());
    this.#appendTurn({
      role: "system",
      icon: "generate",
      name: "Generator",
      content: [{ title: "output", text: JSON.stringify(event.data) }],
    });
  }

  #onError(_event: RunErrorEvent) {
    this.#currentInput = null;
  }

  #currentGraph(): GraphStoreEntry | undefined {
    const data = this.#graphStack.find(
      (graphData) =>
        !graphData.graph.virtual && !graphData.graph.url?.startsWith("module:")
    );
    if (!data) return;

    const url = data.graph.url;
    if (!url) return;

    const entry = this.graphStore?.getEntryByDescriptor(
      data.graph,
      data.graphId
    );
    return entry;
  }
}
