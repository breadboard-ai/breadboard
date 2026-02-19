/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  ConsoleEntry,
  DeepReadonly,
  LLMContent,
  NodeHandlerContext,
  Outcome,
  OutputValues,
  Schema,
  WorkItem,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { A2UIClientWorkItem } from "./a2ui/client-work-item.js";
import { A2UIClientEventMessage } from "./a2ui/schemas.js";
import { v0_8 } from "../../a2ui/index.js";
import { A2UIClient } from "./a2ui/client.js";
import { A2UIAppScreenOutput } from "./a2ui/app-screen-output.js";
import { ConsoleProgressManager } from "./console-progress-manager.js";
import {
  A2UIRenderer,
  ChatChoice,
  ChatChoiceLayout,
  ChatChoicesResponse,
  ChatChoiceSelectionMode,
  ChatInputType,
  ChatManager,
  ChatResponse,
  MemoryManager,
  VALID_INPUT_TYPES,
} from "./types.js";
import { getCurrentStepState } from "./progress-work-item.js";
import type { AgentEventSink } from "./agent-event-sink.js";

export { AgentUI };

export type UserInputType =
  | "singleline-text"
  | "multiline-text"
  | "confirm"
  | "image"
  | "video";

export type UserResponse = {
  file_path?: string;
  text?: string;
};

class AgentUI implements A2UIRenderer, ChatManager {
  readonly client: A2UIClient;

  readonly #consoleEntry: ConsoleEntry | undefined;

  /**
   * Handles the console updates for various parts of agent execution
   */
  readonly progress: ConsoleProgressManager;

  /**
   * The current work item for A2UI interaction. Each interaction creates a new
   * work item with a unique ID, so multiple A2UI screens can be shown.
   */
  #currentWorkItem: A2UIClientWorkItem | undefined;

  readonly #appScreen: AppScreen | undefined;

  readonly #chatLog: LLMContent[] = [];
  readonly #sessionId = crypto.randomUUID();
  #memoryManager: MemoryManager | null = null;
  #context: NodeHandlerContext | null = null;

  readonly #sink: AgentEventSink | undefined;

  constructor(
    private readonly moduleArgs: A2ModuleArgs,
    private readonly translator: PidginTranslator,
    sink?: AgentEventSink
  ) {
    this.#sink = sink;
    this.client = new A2UIClient();
    const { appScreen, consoleEntry } = getCurrentStepState(this.moduleArgs);
    this.#consoleEntry = consoleEntry;
    this.#appScreen = appScreen;
    if (!this.#appScreen) {
      console.warn(
        `Unable to find app screen for this agent. Trying to render UI will fail.`
      );
    }
    this.progress = new ConsoleProgressManager(
      this.#consoleEntry,
      this.#appScreen
    );
  }

  /**
   * Starts a new A2UI interaction by creating a fresh work item and app screen
   * output. This ensures each A2UI screen appears separately in the console
   * view and the app view shows the latest screen.
   */
  #startNewInteraction(
    title: string = "A2UI",
    icon: string = "web"
  ): Outcome<A2UIClientWorkItem> {
    // Finish the previous work item if it exists
    this.#currentWorkItem?.finish();

    if (!this.#consoleEntry) {
      return err(`Unable to create UI: Console is not available`);
    }

    const outputId = crypto.randomUUID();

    // Create new work item for console view
    this.#currentWorkItem = new A2UIClientWorkItem(this.client, title, icon);
    this.#consoleEntry.work.set(outputId, this.#currentWorkItem);

    // Create new app screen output for app view
    if (this.#appScreen) {
      const appScreenOutput = new A2UIAppScreenOutput(this.client);
      this.#appScreen.outputs.set(outputId, appScreenOutput);
      this.#appScreen.last = appScreenOutput;
      this.#appScreen.type = "a2ui";
    }

    return this.#currentWorkItem;
  }

  get chatLog(): DeepReadonly<LLMContent[]> {
    return this.#chatLog;
  }

  setMemoryManager(manager: MemoryManager, context: NodeHandlerContext) {
    this.#memoryManager = manager;
    this.#context = context;
  }

  /**
   * Seeds the in-memory chat log with historical entries from the sheet.
   * Each row is expected to be [timestamp, session_id, role, content].
   * The first row (header) is skipped.
   */
  seedChatLog(rows: unknown[][]): void {
    // Skip header row (row 0 = column names)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      const role = String(row[2]) === "agent" ? "model" : "user";
      const content = String(row[3]);
      this.#chatLog.push({ role, parts: [{ text: content }] });
    }
  }

  #appendChatLogEntry(role: "agent" | "user", content: string): void {
    if (!this.#memoryManager || !this.#context) return;
    const timestamp = new Date().toISOString();
    this.#memoryManager
      .appendToSheet(this.#context, {
        range: "__chat_log__!A:D",
        values: [[timestamp, this.#sessionId, role, content]],
      })
      .catch((e) => console.warn("Failed to append chat log entry:", e));
  }

  #addChatOutput(message: LLMContent): void {
    const outputId = crypto.randomUUID();
    const schema = {
      properties: { message: { type: "object", behavior: ["llm-content"] } },
    } satisfies Schema;

    // Add to app screen outputs directly
    if (this.#appScreen) {
      const entry = { schema, output: { message } as OutputValues };
      this.#appScreen.outputs.set(outputId, entry);
      this.#appScreen.last = entry;
    }

    // Add to console entry as a work item
    if (this.#consoleEntry) {
      const product: WorkItem["product"] = new Map();
      product.set("message", message);
      this.#consoleEntry.work.set(outputId, {
        title: "Response",
        start: 0,
        end: 0,
        elapsed: 0,
        awaitingUserInput: false,
        product,
      });
    }
  }

  async chat(
    pidginString: string,
    inputType: string
  ): Promise<Outcome<ChatResponse>> {
    const typedInputType = (VALID_INPUT_TYPES as readonly string[]).includes(
      inputType
    )
      ? (inputType as ChatInputType)
      : "any";
    const message = await this.translator.fromPidginString(pidginString);
    if (!ok(message)) return message;
    this.#chatLog.push({ ...message, role: "model" });
    this.#appendChatLogEntry("agent", pidginString);
    this.#addChatOutput(message);
    if (!this.#sink) {
      return err(`Unable to request chat input: no event sink available`);
    }
    const chatResponse = await this.#sink.suspend<ChatResponse>({
      type: "waitForInput",
      requestId: crypto.randomUUID(),
      prompt: message,
      inputType: computeFormat(typedInputType),
    });
    this.#chatLog.push({ ...chatResponse.input, role: "user" });
    const userText =
      chatResponse.input.parts
        ?.map((p) => ("text" in p ? p.text : ""))
        .join(" ") || "";
    this.#appendChatLogEntry("user", userText);
    return chatResponse;
  }

  /**
   * Presents choices to the user and returns the selected choice IDs.
   *
   * For "single" mode: renders choice buttons - clicking one returns that ID.
   * For "multiple" mode: renders checkboxes with a submit button.
   *
   * Both message and choice labels support pidgin format with file references.
   */
  async presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    layout: ChatChoiceLayout = "list",
    noneOfTheAboveLabel?: string
  ): Promise<Outcome<ChatChoicesResponse>> {
    // Add the model's message to the chat log
    const messageContent = await this.translator.fromPidginString(message);
    if (!ok(messageContent)) return messageContent;
    this.#chatLog.push({ ...messageContent, role: "model" });
    this.#appendChatLogEntry("agent", message);

    if (!this.#sink) {
      return err(`Unable to present choices: no event sink available`);
    }
    const choicesResponse = await this.#sink.suspend<ChatChoicesResponse>({
      type: "waitForChoice",
      requestId: crypto.randomUUID(),
      prompt: messageContent,
      choices: choices.map((c) => ({
        id: c.id,
        content: { parts: [{ text: c.label }] },
      })),
      selectionMode,
      layout,
      noneOfTheAboveLabel,
    });
    if (!ok(choicesResponse)) return choicesResponse;

    // Build user response text from selected choice labels
    const selectedLabels = choicesResponse.selected
      .map((id: string) => choices.find((c) => c.id === id)?.label ?? id)
      .join(", ");
    this.#chatLog.push({
      role: "user",
      parts: [{ text: selectedLabels }],
    });
    this.#appendChatLogEntry("user", selectedLabels);

    return choicesResponse;
  }

  async render(
    a2UIPayload: unknown[]
  ): Promise<Outcome<Record<string, unknown>>> {
    const rendering = this.renderUserInterface(
      a2UIPayload as v0_8.Types.ServerToClientMessage[]
    );
    if (!ok(rendering)) return rendering;
    return this.awaitUserInput();
  }

  #onA2UIRender?: (messages: v0_8.Types.ServerToClientMessage[]) => void;

  set onA2UIRender(cb: (messages: v0_8.Types.ServerToClientMessage[]) => void) {
    this.#onA2UIRender = cb;
  }

  renderUserInterface(
    messages: v0_8.Types.ServerToClientMessage[],
    title: string = "A2UI",
    icon: string = "web"
  ): Outcome<void> {
    const workItem = this.#startNewInteraction(title, icon);
    if (!ok(workItem)) return workItem;
    const translation = this.translator.fromPidginMessages(messages);
    this.client.processUpdates(translation);

    this.#onA2UIRender?.(messages);

    workItem.renderUserInterface();
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    if (!this.#currentWorkItem) {
      return err(`Unable to await user input: No active A2UI interaction`);
    }
    if (!this.#appScreen) {
      return err(`Unable to await user input: App screen is not available`);
    }

    this.#appScreen.status = "interactive";
    const result = await this.client.awaitUserInput();
    this.#appScreen.status = "processing";
    return result;
  }

  finish() {
    this.progress.finish();
    this.#currentWorkItem?.finish();
  }
}

function computeFormat(inputType: ChatInputType): string {
  switch (inputType) {
    case "any":
      return "asterisk";
    case "file-upload":
      return "upload";
    case "text":
      return "edit_note";
  }
}
