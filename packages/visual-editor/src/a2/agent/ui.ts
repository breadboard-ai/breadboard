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
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { addChatOutput } from "./chat-output.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { A2UIClientEventMessage } from "./a2ui/schemas.js";
import { v0_8 } from "../../a2ui/index.js";
import { A2UIInteraction } from "./a2ui-interaction.js";
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
  /**
   * Shared A2UI rendering core. Owns WorkItem creation, A2UIClient
   * management, and user input awaiting. AgentUI adds pidgin translation
   * on top.
   */
  readonly #interaction: A2UIInteraction;

  readonly #consoleEntry: ConsoleEntry | undefined;

  /**
   * Handles the console updates for various parts of agent execution
   */
  readonly progress: ConsoleProgressManager;

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
    const { appScreen, consoleEntry } = getCurrentStepState(this.moduleArgs);
    this.#consoleEntry = consoleEntry;
    this.#appScreen = appScreen;
    this.#interaction = new A2UIInteraction(consoleEntry, appScreen);
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

  /**
   * Renders an agent → user chat message.
   * Delegates to the shared `addChatOutput()` utility.
   */
  #addChatOutput(message: LLMContent): void {
    addChatOutput(message, this.#consoleEntry, this.#appScreen);
  }

  async chat(
    pidginString: string,
    inputType: string,
    skipLabel?: string
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
      waitForInput: {
        requestId: crypto.randomUUID(),
        prompt: message,
        inputType: computeFormat(typedInputType),
        skipLabel,
      },
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
      waitForChoice: {
        requestId: crypto.randomUUID(),
        prompt: messageContent,
        choices: choices.map((c) => ({
          id: c.id,
          content: { parts: [{ text: c.label }] },
        })),
        selectionMode,
        layout,
        noneOfTheAboveLabel,
      },
    });
    if (!ok(choicesResponse)) return choicesResponse;

    // Build user response text from selected choice labels
    const selectedLabels = choicesResponse.selected.ids
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
    // AgentUI adds pidgin translation before delegating to the shared
    // rendering core.
    const translation = this.translator.fromPidginMessages(messages);
    const result = this.#interaction.renderTranslated(translation, title, icon);

    this.#onA2UIRender?.(messages);

    return result;
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    return this.#interaction.awaitUserInput();
  }

  finish() {
    this.progress.finish();
    this.#interaction.finish();
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
