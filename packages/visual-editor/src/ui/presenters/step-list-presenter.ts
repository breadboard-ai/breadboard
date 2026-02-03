/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { effect } from "signal-utils/subtle/microtask-effect";
import type { LLMContent, WorkItem } from "@breadboard-ai/types";
import type { SCA } from "../../sca/sca.js";
import type {
  FlowGenGenerationStatus,
  StepListStepState,
  ProjectRun,
} from "../state/types.js";

export { StepListPresenter };

/**
 * StepListPresenter - UI-layer presenter that derives step list state.
 *
 * AVAST PLANNER HACK: Modified to show work items from the first console entry
 * instead of showing steps themselves.
 *
 * ## Lifecycle
 *
 * The host element (e.g., step-list-view) should:
 * 1. Call `connect(sca, run)` in connectedCallback
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

  // AVAST PLANNER: Make #run a signal so effect re-runs when run changes
  @signal
  accessor #run: ProjectRun | null = null;

  /**
   * Connects the presenter to SCA and starts the effect.
   * Call this in the host element's connectedCallback.
   *
   * AVAST PLANNER: Now also takes projectRun to access the reactive console.
   */
  connect(sca: SCA, projectRun?: ProjectRun | null): void {
    if (this.#disposeEffect) {
      // Already connected
      return;
    }

    this.#sca = sca;
    this.#run = projectRun ?? null;

    this.#disposeEffect = effect(() => {
      this.#updateSteps();
    });
  }

  /**
   * Updates the project run reference.
   * Call this when the run property changes.
   */
  setRun(projectRun: ProjectRun | null): void {
    this.#run = projectRun;
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
    this.#run = null;
    this.steps = new Map();
  }

  /**
   * AVAST PLANNER HACK: Updates the steps map with product entries (thoughts,
   * function calls) from the first console entry's work items.
   */
  #updateSteps(): void {
    if (!this.#sca) return;

    const { controller } = this.#sca;
    const flowgenStatus = controller.global.flowgenInput.state.status;

    // Build the steps map - AVAST: now from product entries in work items
    const newSteps = new Map<string, StepListStepState>();

    // AVAST PLANNER: Use project run console instead of controller console
    const runConsole = this.#run?.console;
    if (!runConsole) {
      this.steps = newSteps;
      return;
    }

    // Get the first console entry and iterate its work items
    const firstEntry = runConsole.values().next().value;
    if (!firstEntry) {
      this.steps = newSteps;
      return;
    }

    // Access work.size to subscribe to the SignalMap
    const workSize = firstEntry.work.size;
    if (workSize === 0) {
      this.steps = newSteps;
      return;
    }

    // Iterate work items from the first entry
    // Track function calls to couple with responses
    const functionCallSteps = new Map<string, string>(); // functionName -> productId

    for (const [, workItem] of firstEntry.work.entries()) {
      // Access signal properties to ensure reactivity tracking
      const item = workItem as WorkItem & {
        type?: string;
        elapsed?: number;
        awaitingUserInput?: boolean;
      };

      // Read signal properties - this subscribes the effect to changes
      const end = item.end;
      const workItemStatus = this.#getWorkItemStatus(
        end,
        item.type,
        flowgenStatus
      );

      // AVAST PLANNER: Now iterate through product entries (thoughts, function calls)
      if (item.product && item.product.size > 0) {
        for (const [productId, productEntry] of item.product.entries()) {
          // Skip a2ui entries (they start with "a2ui-")
          if (productId.startsWith("a2ui-")) {
            continue;
          }

          const result = this.#processProductEntry(
            productId,
            productEntry,
            workItemStatus,
            functionCallSteps,
            newSteps
          );

          if (result) {
            newSteps.set(result.id, result.step);
          }
        }
      }
    }

    this.steps = newSteps;
  }

  /**
   * AVAST PLANNER: Process a product entry and return step state if applicable
   */
  #processProductEntry(
    productId: string,
    entry: unknown,
    _status: "loading" | "working" | "ready" | "complete" | "pending",
    functionCallSteps: Map<string, string>,
    existingSteps: Map<string, StepListStepState>
  ): { id: string; step: StepListStepState } | null {
    // Skip non-console-update entries
    if (!this.#isConsoleUpdate(entry)) {
      return null;
    }

    const { title, body } = entry as {
      type: string;
      title: string;
      body?: LLMContent;
    };

    // Show Objective as "Objective Received" - first item when run starts
    if (title.toLowerCase() === "objective") {
      return {
        id: productId,
        step: {
          icon: "summarize",
          title: "Objective Received",
          status: "complete",
          prompt: "",
          label: "Start",
          tags: ["objective"],
        },
      };
    }

    // Check if this is a function call
    if (body?.parts) {
      const functionCallPart = body.parts.find((p) => "functionCall" in p) as
        | { functionCall?: { name: string; args?: Record<string, unknown> } }
        | undefined;

      if (functionCallPart?.functionCall) {
        const functionName = functionCallPart.functionCall.name;
        const args = functionCallPart.functionCall.args ?? {};

        // Track this function call
        functionCallSteps.set(functionName, productId);

        // Get icon from function info mapping
        const { title: friendlyName, icon: functionIcon } =
          this.#getFriendlyFunctionInfo(functionName);

        // AVAST PLANNER: Use status_update from function args if available!
        // This gives us the actual description the LLM chose for this call.
        const statusUpdate = args.status_update as string | undefined;
        const displayTitle = statusUpdate
          ? statusUpdate.replace(/\.+$/, "") // Remove trailing dots
          : friendlyName;

        return {
          id: productId,
          step: {
            icon: functionIcon,
            title: displayTitle,
            status: "working", // Function calls start as working
            prompt: "",
            label: "Function Call",
            tags: ["function"],
          },
        };
      }
    }

    // Check if this is a function response
    const isFunctionResult = title.toLowerCase().includes("function response");
    if (isFunctionResult) {
      // Find the matching function call and mark it complete
      // The function name is typically in the most recent function call
      for (const [, callId] of functionCallSteps.entries()) {
        const existingCall = existingSteps.get(callId);
        if (existingCall && existingCall.status === "working") {
          // Mark the function call as complete
          existingSteps.set(callId, {
            ...existingCall,
            status: "complete",
          });
          break; // Only mark one as complete
        }
      }
      // Skip showing the function result separately
      return null;
    }

    // Handle thoughts
    const isThought = title.toLowerCase().includes("thought");
    if (isThought) {
      let prompt = "";
      if (body?.parts) {
        const textPart = body.parts.find(
          (p): p is { text: string } =>
            "text" in p && typeof p.text === "string"
        );
        if (textPart) {
          prompt = textPart.text;
        }
      }

      // Extract title from thought text (bold text like **title**)
      const thoughtTitle = this.#getTitleFromThought(prompt) ?? "Thinking...";

      return {
        id: productId,
        step: {
          icon: "spark",
          title: thoughtTitle,
          status: "complete", // Thoughts are instantaneous - always complete
          prompt,
          label: "Thought",
          tags: ["thought"],
        },
      };
    }

    // Skip other entries (Send request, etc.)
    return null;
  }

  /**
   * AVAST PLANNER: Map function names to user-friendly display names and icons
   */
  #getFriendlyFunctionInfo(functionName: string): {
    title: string;
    icon: string;
  } {
    const functionInfo: Record<string, { title: string; icon: string }> = {
      // System functions (system.ts)
      system_objective_fulfilled: {
        title: "Completing objective",
        icon: "check_circle",
      },
      system_failed_to_fulfill_objective: {
        title: "Unable to fulfill",
        icon: "error",
      },
      system_list_files: { title: "Listing files", icon: "folder_open" },
      system_write_file: { title: "Writing file", icon: "edit_document" },
      system_read_text_from_file: {
        title: "Reading file",
        icon: "description",
      },
      system_create_task_tree: {
        title: "Creating task tree",
        icon: "account_tree",
      },
      system_mark_completed_tasks: {
        title: "Marking tasks complete",
        icon: "task_alt",
      },

      // Chat functions (chat.ts)
      chat_request_user_input: { title: "Asking User", icon: "chat_mirror" },
      chat_present_choices: { title: "Presenting choices", icon: "list_alt" },

      // Generate functions (generate.ts) - icons from main.ts
      generate_text: { title: "Generating text", icon: "text_analysis" },
      generate_images: { title: "Generating images", icon: "photo_spark" },
      generate_video: { title: "Generating video", icon: "videocam_auto" },
      generate_speech_from_text: {
        title: "Generating speech",
        icon: "audio_magic_eraser",
      },
      generate_music_from_text: {
        title: "Generating music",
        icon: "audio_magic_eraser",
      },
      generate_and_execute_code: { title: "Running code", icon: "code" },

      // Memory functions (memory.ts)
      memory_create_sheet: { title: "Creating memory sheet", icon: "note_add" },
      memory_read_sheet: { title: "Reading memory sheet", icon: "table_view" },
      memory_update_sheet: {
        title: "Updating memory sheet",
        icon: "edit_note",
      },
      memory_delete_sheet: { title: "Deleting memory sheet", icon: "delete" },
      memory_get_metadata: { title: "Getting memory metadata", icon: "info" },

      // Google Drive functions (google-drive.ts)
      google_drive_upload_file: {
        title: "Uploading to Drive",
        icon: "cloud_upload",
      },
      google_drive_create_folder: {
        title: "Creating Drive folder",
        icon: "create_new_folder",
      },
    };

    // Return info if found, otherwise format the function name nicely
    if (functionInfo[functionName]) {
      return functionInfo[functionName];
    }

    // Convert snake_case to Title Case, use generic icon
    const title = functionName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return { title, icon: "smart_toy" };
  }

  /**
   * AVAST PLANNER: Extract title from thought text (bold text like **title**)
   */
  #getTitleFromThought(thought: string): string | null {
    const match = thought.match(/\*\*(.*?)\*\*/);
    return match ? match[1] : null;
  }

  /**
   * Check if entry is a ConsoleUpdate
   */
  #isConsoleUpdate(entry: unknown): boolean {
    return (
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      ((entry as { type: string }).type === "text" ||
        (entry as { type: string }).type === "links")
    );
  }

  /**
   * AVAST PLANNER: Determines status for a work item
   */
  #getWorkItemStatus(
    end: number | null | undefined,
    type: string | undefined,
    flowgenStatus: FlowGenGenerationStatus | string
  ): "loading" | "working" | "ready" | "complete" | "pending" {
    if (flowgenStatus === "generating") {
      return "working";
    }
    if (end !== null && end !== undefined) {
      return "complete";
    }
    if (type === "input") {
      return "working"; // Still awaiting input
    }
    return "pending";
  }
}
