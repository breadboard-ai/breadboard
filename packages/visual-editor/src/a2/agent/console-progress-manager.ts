/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  ConsoleEntry,
  FunctionCallCapabilityPart,
  JsonSerializable,
  LLMContent,
} from "@breadboard-ai/types";
import { GeminiBody } from "../a2/gemini.js";
import { AgentProgressManager } from "./types.js";
import { llm, progressFromThought } from "../a2/utils.js";
import { StatusUpdateCallbackOptions } from "./function-definition.js";
import { StarterPhraseVendor } from "./starter-phrase-vendor.js";
import { ConsoleWorkItem } from "./console-work-item.js";
import { ProgressReporter } from "./types.js";

export { ConsoleProgressManager };

/**
 * Friendly names for functions that don't use statusUpdateSchema.
 * These names are used as fallback titles in the console progress UI.
 */
const FUNCTION_FRIENDLY_NAMES: Record<string, string> = {
  system_objective_fulfilled: "Returning final outcome",
  system_failed_to_fulfill: "Unable to proceed",
  system_write_file: "Writing to file",
  system_read_text_from_file: "Reading from file",
  system_create_task_tree: "Creating task tree",
  system_mark_completed_tasks: "Marking tasks complete",
  chat_request_user_input: "Asking the user",
  memory_update_sheet: "Updating memory",
};

/**
 * Functions that should not create a work item because
 * they are handled by other UI mechanisms.
 */
const SKIP_WORK_ITEM_FUNCTIONS = new Set(["chat_present_choices"]);

/**
 * Parsed thought with optional title and body.
 */
type ParsedThought = {
  title: string | null;
  body: string;
};

/**
 * Parse a thought string to extract title (from **Title**) and body.
 */
function parseThought(text: string): ParsedThought {
  const match = text.match(/\*\*(.+?)\*\*/);
  if (!match) {
    return { title: null, body: text };
  }
  const title = match[1];
  const body = text.replace(match[0], "").trim();
  return { title, body };
}

/**
 * Trim trailing ellipsis ("...") from a string.
 */
function trimEllipsis(text: string): string {
  return text.replace(/\.{3}$/, "");
}

/**
 * Convert a string to Title Case.
 */
function toTitleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Manages console progress updates for agent execution.
 * Creates individual WorkItems for each progress update and adds them to the
 * console entry. Also manages AppScreen updates for the app view.
 */
class ConsoleProgressManager implements AgentProgressManager {
  readonly #consoleEntry: ConsoleEntry | undefined;
  readonly #screen: AppScreen | undefined;
  #previousStatus: string | undefined;
  #agentSession: ConsoleWorkItem | undefined;
  #pendingCalls: Map<string, ConsoleWorkItem> = new Map();

  constructor(
    consoleEntry: ConsoleEntry | undefined,
    screen: AppScreen | undefined
  ) {
    this.#consoleEntry = consoleEntry;
    this.#screen = screen;
  }

  #addWorkItem(
    itemTitle: string,
    productTitle: string,
    icon: string,
    body: LLMContent
  ) {
    if (!this.#consoleEntry) return;

    const update = { type: "text" as const, title: productTitle, icon, body };
    const workItem = new ConsoleWorkItem(toTitleCase(itemTitle), icon, update);
    workItem.finish(); // Mark as done immediately
    this.#consoleEntry.work.set(crypto.randomUUID(), workItem);
  }

  /**
   * The agent started execution.
   * Creates the agent session WorkItem that accumulates early updates.
   */
  startAgent(objective: LLMContent) {
    if (this.#screen) {
      this.#screen.progress = StarterPhraseVendor.instance.phrase();
      this.#screen.expectedDuration = -1;
    }
    if (this.#consoleEntry) {
      const update = {
        type: "text" as const,
        title: "Objective",
        icon: "summarize",
        body: objective,
      };
      this.#agentSession = new ConsoleWorkItem(
        "Agent Session",
        "button_magic",
        update
      );
      this.#consoleEntry.work.set(crypto.randomUUID(), this.#agentSession);
    }
  }

  /**
   * The agent is generating layouts.
   */
  generatingLayouts(uiPrompt: LLMContent | undefined) {
    if (this.#screen) {
      this.#screen.progress = "Generating layouts";
      this.#screen.expectedDuration = 70;
    }
    this.#addWorkItem(
      "Generating Layouts",
      "Generating Layouts",
      "web",
      uiPrompt ?? llm``.asContent()
    );
  }

  /**
   * The agent sent initial request.
   * Appends to the agent session WorkItem.
   */
  sendRequest(model: string, body: GeminiBody) {
    if (this.#agentSession) {
      this.#agentSession.addProduct({
        type: "text",
        title: "Send request",
        icon: "upload",
        body: {
          parts: [
            { text: `Calling model: ${model}` },
            { json: body as JsonSerializable },
          ],
        },
      });
    }
  }

  /**
   * The agent produced a thought.
   */
  thought(text: string) {
    const { title, body } = parseThought(text);
    this.#addWorkItem(
      title ?? "Thought",
      "Thought",
      "spark",
      llm`${body}`.asContent()
    );
    if (this.#screen) {
      this.#previousStatus = this.#screen.progress;
      this.#screen.progress = progressFromThought(text);
      this.#screen.expectedDuration = -1;
    }
  }

  /**
   * The agent produced a function call.
   * Returns a unique ID for matching with the corresponding function result,
   * and a reporter for progress updates scoped to this function call.
   */
  functionCall(
    part: FunctionCallCapabilityPart,
    icon?: string
  ): { callId: string; reporter: ProgressReporter | null } {
    const callId = crypto.randomUUID();
    // Skip work item for functions handled by other UI mechanisms
    if (SKIP_WORK_ITEM_FUNCTIONS.has(part.functionCall.name)) {
      return { callId, reporter: null };
    }
    const effectiveIcon = icon ?? "robot_server";
    if (this.#consoleEntry) {
      const args = part.functionCall.args as Record<string, unknown>;
      const statusUpdate =
        typeof args.status_update === "string" ? args.status_update : null;
      const friendlyName = FUNCTION_FRIENDLY_NAMES[part.functionCall.name];
      const itemTitle = trimEllipsis(
        statusUpdate ?? friendlyName ?? `Function: ${part.functionCall.name}`
      );
      const update = {
        type: "text" as const,
        title: `Calling function "${part.functionCall.name}"`,
        icon: effectiveIcon,
        body: { parts: [part] },
      };
      const workItem = new ConsoleWorkItem(
        toTitleCase(itemTitle),
        effectiveIcon,
        update
      );
      // Don't finish yet - will be finished when result arrives
      this.#pendingCalls.set(callId, workItem);
      this.#consoleEntry.work.set(callId, workItem);
      return { callId, reporter: workItem };
    }
    return { callId, reporter: null };
  }

  /**
   * The agent function call produced an update.
   * If it's a thought, adds it as a product to the function's work item.
   * Otherwise, updates the screen progress.
   */
  functionCallUpdate(
    callId: string,
    status: string | null,
    options?: StatusUpdateCallbackOptions
  ) {
    if (options?.isThought) {
      if (!status) return;
      const workItem = this.#pendingCalls.get(callId);
      if (workItem) {
        const { title, body } = parseThought(status);
        workItem.addProduct({
          type: "text",
          title: title ?? "Thought",
          icon: "spark",
          body: llm`${body}`.asContent(),
        });
      }
      // Also update the screen progress
      if (this.#screen) {
        this.#previousStatus = this.#screen.progress;
        this.#screen.progress = progressFromThought(status);
        this.#screen.expectedDuration = -1;
      }
    } else {
      if (!this.#screen) return;

      if (status == null) {
        if (this.#previousStatus) {
          this.#screen.progress = this.#previousStatus;
        }
        this.#screen.expectedDuration = -1;
      } else {
        // Remove the occasional ellipsis from the status
        status = trimEllipsis(status);
        if (options?.expectedDurationInSec) {
          this.#screen.expectedDuration = options.expectedDurationInSec;
        } else {
          this.#screen.expectedDuration = -1;
        }

        this.#previousStatus = this.#screen.progress;
        this.#screen.progress = status;
      }
    }
  }

  /**
   * The agent produced a function result.
   * Finds the WorkItem by callId and appends the result.
   */
  functionResult(callId: string, content: LLMContent) {
    const workItem = this.#pendingCalls.get(callId);
    if (workItem) {
      workItem.addProduct({
        type: "text",
        title: "Function response",
        icon: "robot_server",
        body: content,
      });
      workItem.finish();
      this.#pendingCalls.delete(callId);
    }
  }

  /**
   * The agent finished executing.
   * Closes the agent session WorkItem.
   */
  finish() {
    if (this.#screen) {
      this.#screen.progress = undefined;
      this.#screen.expectedDuration = -1;
    }
    this.#agentSession?.finish();
  }
}
