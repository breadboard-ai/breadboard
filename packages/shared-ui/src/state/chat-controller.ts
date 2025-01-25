/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphIdentifier,
  GraphStartProbeData,
  LLMContent,
  NodeMetadata,
  OutputValues,
} from "@breadboard-ai/types";
import { MutableGraphStore, Schema } from "@google-labs/breadboard";
import {
  HarnessRunner,
  RunErrorEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunOutputEvent,
} from "@google-labs/breadboard/harness";
import {
  ChatContent,
  ChatConversationState,
  ChatState,
  ChatStatus,
  ChatSystemTurnState,
} from "./types";
import { formatError } from "../utils/format-error";

export { ChatController };

type PendingTurnState = {
  turn: ChatSystemTurnState;
  graph: GraphDescriptor;
  graphId: GraphIdentifier;
};

class ChatController {
  #status: ChatStatus = "stopped";
  #conversation: ChatConversationState[] = [];
  #state: ChatState = this.#initialChatState();
  #stale: boolean = false;
  #currentInput: RunInputEvent | null = null;
  #graphStack: GraphStartProbeData[] = [];
  #pending: Set<PendingTurnState> = new Set();

  constructor(
    public readonly runner: HarnessRunner | null,
    public readonly graphStore: MutableGraphStore | null
  ) {
    if (!runner) return;

    runner.addEventListener("abort", () => {
      this.#currentInput = null;
      this.#status = "stopped";
      this.#stale = true;
    });
    runner.addEventListener("start", () => {
      this.#status = "running";
      this.#stale = true;
    });
    runner.addEventListener("pause", () => {
      this.#status = "paused";
      this.#stale = true;
    });
    runner.addEventListener("resume", (event) => {
      this.#finalizeInput(event.data.inputs || {});
      this.#status = "running";
      this.#stale = true;
    });
    runner.addEventListener("end", () => {
      this.#status = "stopped";
      this.#stale = true;
    });
    runner.addEventListener("graphstart", this.#onGraphstart.bind(this));
    runner.addEventListener("graphend", this.#onGraphend.bind(this));
    runner.addEventListener("input", this.#onInput.bind(this));
    runner.addEventListener("output", this.#onOutput.bind(this));
    runner.addEventListener("error", this.#onError.bind(this));

    graphStore?.addEventListener("update", () => {
      // Technically, the event has `mainGraphId` and we should only update
      // pending entries that have the id, but I don't yet trust the GraphStore
      // machinery to always give me the right id, so I'll brute-force and
      // update all of them.

      // Also need setTimeout, because unfortunately (yikes) this event
      // fires just BEFORE the value actually updated.

      [...this.#pending.values()].forEach((pending) => {
        const { turn, graph, graphId } = pending;
        const entry = this.graphStore?.getEntryByDescriptor(graph, graphId);
        if (!entry?.updating) {
          this.#pending.delete(pending);
          this.#replaceTurn(turn, entry?.icon, entry?.title);
          this.#stale = true;
        }
      });
    });
  }

  state(): ChatState {
    this.#refreshChatState();
    return this.#state;
  }

  #initialChatState(): ChatState {
    return {
      conversation: [],
      status: "stopped",
    };
  }

  #refreshChatState() {
    if (!this.#stale) return;

    this.#state = {
      conversation: this.#conversation,
      status: this.#status,
    };
    this.#stale = false;
  }

  #finalizeInput(inputs: OutputValues) {
    if (!this.#currentInput) return;

    const {
      data: {
        inputArguments: { schema: { properties } = { properties: {} } },
      },
    } = this.#currentInput;

    const content = toChatContent(inputs, properties);
    this.#appendTurn({ role: "user", content });

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

  #replaceTurn(turn: ChatSystemTurnState, icon?: string, name?: string) {
    const index = this.#conversation.indexOf(turn);
    if (index >= 0) {
      this.#conversation.splice(index, 1, { ...turn, icon, name });
      this.#conversation = [...this.#conversation];
    }
  }

  #appendTurn(turn: ChatConversationState) {
    this.#stale = true;
    this.#conversation = [...this.#conversation, turn];
  }

  #onOutput(event: RunOutputEvent) {
    const properties = (event.data.node.configuration?.schema as Schema)
      ?.properties;
    const metadata = event.data.node.metadata;
    const content = toChatContent(event.data.outputs, properties);
    const turn = this.#createSystemTurn(content, metadata);
    this.#appendTurn(turn);
  }

  #onError(event: RunErrorEvent) {
    this.#currentInput = null;
    this.#status = "stopped";
    this.#appendTurn(
      this.#createSystemTurn([
        {
          title: "Stopping due to the following error",
          error: formatError(event.data.error),
        },
      ])
    );
    this.#stale = true;
  }

  #createSystemTurn(
    content: ChatContent[],
    metadata?: NodeMetadata
  ): ChatSystemTurnState {
    const turn: ChatSystemTurnState = {
      role: "system",
      icon: metadata?.icon,
      name: metadata?.title,
      content,
    };
    // 0) If icon and name already present, exit early.
    if (turn.icon || turn.name) {
      return turn;
    }

    // 1) Find the current graph that might have an icon in the graph stack.
    const data = this.#graphStack.find(
      (graphData) =>
        !graphData.graph.virtual && !graphData.graph.url?.startsWith("module:")
    );
    if (!data) return turn;

    const url = data.graph.url;
    if (!url) return turn;

    const { graph, graphId } = data;

    // 2) Find GraphStoreEntry by descriptor. This is the same entry as the
    // one we see in GraphStore.graphs()
    const entry = this.graphStore?.getEntryByDescriptor(graph, graphId);
    if (!entry) return turn;

    // 3) If the entry is not yet fully baked, we place it into the pending set.
    if (entry.updating) {
      this.#pending.add({ turn, graph, graphId });
    }

    // 4) .. and return the updated turn in either case.
    turn.icon ??= entry.icon;
    turn.name ??= entry.title;
    return turn;
  }
}

function inferProps(inputs: OutputValues): Record<string, Schema> {
  if (!inputs) return {};
  return Object.fromEntries(Object.keys(inputs).map((key) => [key, {}]));
}

function toChatContent(
  inputs: OutputValues,
  properties: Record<string, Schema> | undefined
): ChatContent[] {
  return Object.entries(properties || inferProps(inputs)).map(
    ([name, schema]): ChatContent => {
      const title = schema.title || name;
      const value = inputs[name];
      if (schema.behavior?.includes("llm-content")) {
        return { title, context: [value as LLMContent] };
      } else if (
        schema.items &&
        (schema.items as Schema).behavior?.includes("llm-content")
      ) {
        return { title, context: value as LLMContent[] };
      } else if (schema.type === "string") {
        return { title, text: value as string };
      } else {
        return { title, object: value };
      }
    }
  );
}
