import {
  AppScreen,
  ConsoleEntry,
  ConsoleLink,
  ConsoleUpdate,
  JsonSerializable,
  LLMContent,
  NodeMetadata,
  SimplifiedA2UIClient,
  WorkItem,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { now } from "./now.js";
import type { ErrorMetadata } from "../a2/utils.js";
import { v0_8 } from "../../a2ui/index.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import type { ProgressReporter } from "./types.js";

export { ProgressWorkItem, createReporter, getCurrentStepState };
export type { ProgressReporter };

export type Link = {
  uri: string;
  title: string;
  iconUri: string;
};

class ProgressWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }
  /**
   * This means something different from us awaiting the user input in the
   * Console vernacular. Here, we always return false for now.
   */
  readonly awaitingUserInput = false;

  readonly start: number;

  readonly openByDefault = true;

  readonly chat = false;

  readonly workItemId = crypto.randomUUID();

  readonly product: Map<string, ConsoleUpdate> = new SignalMap();

  #updateCounter = 0;

  constructor(
    public readonly title: string,
    public readonly icon: string,
    private readonly screen: AppScreen | undefined
  ) {
    this.start = performance.now();
  }

  #add(title: string, icon: string, body: LLMContent) {
    const key = `update-${this.#updateCounter++}`;
    this.product.set(key, { type: "text", title, icon, body });
  }

  /**
   * Add JSON data to the progress work item.
   * Wraps the data in LLMContent format internally.
   */
  addJson(title: string, data: unknown, icon?: string) {
    this.#add(title, icon ?? "info", {
      parts: [{ json: data as JsonSerializable }],
    });
  }

  /**
   * Add text to the progress work item.
   * Wraps the text in LLMContent format internally.
   */
  addText(title: string, text: string, icon?: string) {
    this.#add(title, icon ?? "info", { parts: [{ text }] });
  }

  /**
   * Add LLMContent to the progress work item.
   */
  addContent(title: string, body: LLMContent, icon?: string) {
    this.#add(title, icon ?? "info", body);
  }

  /**
   * Add an error to the progress work item.
   * Wraps the error message in LLMContent format internally.
   */
  addError(error: { $error: string; metadata?: ErrorMetadata }) {
    this.#add("Error", "warning", { parts: [{ text: error.$error }] });
    return error;
  }

  /**
   * Add links to the progress work item.
   */
  addLinks(title: string, links: ConsoleLink[], icon?: string) {
    const key = `update-${this.#updateCounter++}`;
    this.product.set(key, {
      type: "links",
      title,
      icon: icon ?? "link",
      links,
    });
  }

  /**
   * Add A2UI content to the progress work item.
   * Creates a SimplifiedA2UIClient with a processor and no-op receiver.
   * @param messages - A2UI ServerToClientMessage array (untyped from parsed JSON)
   */
  addA2UI(messages: unknown[]) {
    const processor = v0_8.Data.createSignalA2UIModelProcessor();
    processor.processMessages(messages as v0_8.Types.ServerToClientMessage[]);
    const key = `a2ui-${this.#updateCounter++}`;
    const client: SimplifiedA2UIClient = {
      processor,
      receiver: { sendMessage: () => {} }, // No-op receiver for display-only
    };
    // Cast to unknown first since product map type doesn't include SimplifiedA2UIClient directly
    (this.product as Map<string, unknown>).set(key, client);
  }

  /**
   * The agent finished executing.
   */
  finish() {
    if (this.screen) {
      this.screen.progress = undefined;
      this.screen.expectedDuration = -1;
    }
    this.end = performance.now();
  }
}

type StepState = {
  title: string;
  appScreen: AppScreen | undefined;
  consoleEntry: ConsoleEntry | undefined;
};

function getCurrentStepState(moduleArgs: A2ModuleArgs): StepState {
  const { currentStep, getProjectRunState } = moduleArgs.context;
  const stepId = currentStep?.id;
  if (!stepId) {
    return {
      title: "",
      appScreen: undefined,
      consoleEntry: undefined,
    };
  }
  const runState = getProjectRunState?.();
  return {
    title: currentStep?.metadata?.title || "",
    appScreen: runState?.app.screens.get(stepId),
    consoleEntry: runState?.console.get(stepId),
  };
}

/**
 * Creates a reporter (ProgressWorkItem) and registers it with the console.
 */
function createReporter(
  moduleArgs: A2ModuleArgs,
  options: NodeMetadata
): ProgressWorkItem {
  const { consoleEntry, appScreen } = getCurrentStepState(moduleArgs);
  const reporter = new ProgressWorkItem(
    options.title ?? "Progress",
    options.icon ?? "info",
    appScreen
  );
  if (consoleEntry) {
    consoleEntry.work.set(crypto.randomUUID(), reporter);
  }
  return reporter;
}
