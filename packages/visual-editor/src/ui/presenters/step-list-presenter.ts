/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { reactive } from "../../sca/reactive.js";
import type {
  ConsoleEntry,
  GraphDescriptor,
  LLMContent,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import type { SCA } from "../../sca/sca.js";
import type {
  FlowGenGenerationStatus,
  StepListStepState,
} from "../../sca/types.js";

export { StepListPresenter };

/**
 * StepListPresenter - UI-layer presenter that derives step list state.
 *
 * This presenter combines data from:
 * - RunController.console (console entries)
 * - GraphController.editor (graph metadata for prompts/labels)
 * - FlowgenInputController (generation status)
 *
 * It watches these sources via an effect and updates a reactive `steps` signal
 * that UI components can consume for rendering.
 *
 * ## Lifecycle
 *
 * The host element (e.g., step-list-view) should:
 * 1. Call `connect(sca)` in connectedCallback
 * 2. Call `disconnect()` in disconnectedCallback
 *
 * This ensures the internal effect is properly disposed when the element
 * is removed from the DOM.
 */
class StepListPresenter {
  @signal
  accessor steps: Map<string, StepListStepState> = new Map();

  #disposeEffect: (() => void) | null = null;
  #sca: SCA | null = null;

  /**
   * Connects the presenter to SCA and starts the effect.
   * Call this in the host element's connectedCallback.
   */
  connect(sca: SCA): void {
    if (this.#disposeEffect) {
      // Already connected
      return;
    }

    this.#sca = sca;

    this.#disposeEffect = reactive(() => {
      this.#updateSteps();
    });
  }

  /**
   * Disconnects the presenter and stops the effect.
   * Call this in the host element's disconnectedCallback.
   */
  disconnect(): void {
    if (this.#disposeEffect) {
      this.#disposeEffect();
      this.#disposeEffect = null;
    }
    this.#sca = null;
    this.steps = new Map();
  }

  /**
   * Updates the steps map by reading from controllers and services.
   */
  #updateSteps(): void {
    if (!this.#sca) return;

    const { controller } = this.#sca;
    const runController = controller.run.main;
    const runControllerConsole = runController.console;
    const graph = controller.editor.graph.editor?.raw() ?? null;
    const flowgenStatus = controller.global.flowgenInput.state.status;

    // Build the steps map
    const newSteps = new Map<string, StepListStepState>();

    for (const [id, entry] of runControllerConsole.entries()) {
      const status = this.#getStatus(entry.status?.status, flowgenStatus);
      const { icon, title, tags } = entry;

      let prompt: string;
      let label: string;

      if (tags?.includes("input")) {
        prompt = this.#promptFromInput(entry);
        label = this.#labelFromInput(id, graph) ?? "Question from user";
      } else {
        prompt = this.#promptFromIntent(id, graph) ?? "";
        label = "Prompt";
      }

      newSteps.set(id, {
        icon,
        title,
        status,
        prompt,
        label,
        tags,
      });
    }

    this.steps = newSteps;
  }

  /**
   * Determines the display status for a step.
   */
  #getStatus(
    nodeStatus: string | undefined,
    flowgenStatus: FlowGenGenerationStatus | string
  ): "loading" | "working" | "ready" | "complete" | "pending" {
    if (flowgenStatus === "generating") {
      return "working";
    }
    switch (nodeStatus) {
      case "running":
      case "working":
      case "waiting":
        return "working";
      case "done":
      case "succeeded":
        return "complete";
      case "inactive":
      case "ready":
        return "ready";
      case "failed":
      case "skipped":
      case "interrupted":
        return "complete"; // Show as complete but with different styling if needed
      default:
        return "pending";
    }
  }

  /**
   * Extracts prompt text from an input console entry.
   */
  #promptFromInput(entry: ConsoleEntry): string {
    const output = entry.output?.values?.()?.next?.()?.value as
      | { parts?: { text?: string }[] }
      | undefined;
    const part = output?.parts?.at?.(0) as TextCapabilityPart | undefined;
    return part?.text ?? "";
  }

  /**
   * Gets the label for an input step from the graph.
   */
  #labelFromInput(
    id: string,
    graph: GraphDescriptor | null
  ): string | undefined {
    if (!graph) return undefined;
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return undefined;

    // Try to get a meaningful label from the node's configuration
    const config = node.configuration as Record<string, unknown> | undefined;
    if (!config) return undefined;

    // Common patterns for input labels
    return (
      (config.title as string | undefined) ??
      (config.description as string | undefined)
    );
  }

  /**
   * Extracts prompt text from a node's intent or configuration.
   */
  #promptFromIntent(
    id: string,
    graph: GraphDescriptor | null
  ): string | undefined {
    if (!graph) return undefined;
    const node = graph.nodes.find((n) => n.id === id);
    if (!node) return undefined;

    // First try step_intent from metadata
    const intent = node.metadata?.step_intent;
    if (typeof intent === "string") return intent;

    // Fall back to configuration prompt
    const config = node.configuration as Record<string, unknown> | undefined;
    if (!config) return undefined;

    // Try config$prompt
    const configPrompt = this.#textFromLLMContent(config.config$prompt);
    if (configPrompt) return configPrompt;

    // Try text field
    return this.#textFromLLMContent(config.text);
  }

  /**
   * Extracts text from LLMContent if it's a simple text structure.
   */
  #textFromLLMContent(content: unknown): string | undefined {
    if (typeof content === "string") return content;
    if (!content || typeof content !== "object") return undefined;

    // Handle array of parts
    if (Array.isArray(content)) {
      const llmContent = content as LLMContent[];
      for (const item of llmContent) {
        if (item.parts) {
          for (const part of item.parts) {
            if ("text" in part && typeof part.text === "string") {
              return part.text;
            }
          }
        }
      }
    }

    return undefined;
  }
}
