/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RootController } from "../root-controller.js";
import type { AppEnvironment } from "../../../environment/environment.js";
import { createTrustedFeedbackURL } from "../../../../ui/trusted-types/feedback-url.js";
import { field } from "../../decorators/field.js";
import type { TrustedScriptURL } from "trusted-types/lib/index.js";
import { Utils } from "../../../utils.js";
import type { LLMContent } from "@breadboard-ai/types";
import {
  eventType,
  eventPayload,
  type AgentEvent,
  type Payload,
} from "../../../../a2/agent/agent-event.js";

type UserFeedbackApi = {
  startFeedback(
    configuration: {
      productId: string;
      bucket?: string;
      productVersion?: string;
      flow?: string;
      report?: {
        description: string;
        [key: string]: unknown;
      };
      callback?: () => void;
      onLoadCallback?: () => void;
    },
    productData?: { [key: string]: string }
  ): void;
};

type WindowWithUserFeedbackApi = Window &
  typeof globalThis & {
    userfeedback: { api: UserFeedbackApi };
  };

let googleFeedbackApiPromise: Promise<UserFeedbackApi> | undefined;
function loadGoogleFeedbackApi(): Promise<UserFeedbackApi> {
  if (googleFeedbackApiPromise) {
    return googleFeedbackApiPromise;
  }

  googleFeedbackApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    (script as { src: string | TrustedScriptURL }).src =
      createTrustedFeedbackURL("");
    script.async = true;
    script.addEventListener(
      "load",
      () => resolve((window as WindowWithUserFeedbackApi).userfeedback.api),
      { once: true }
    );
    script.addEventListener("error", (reason) => reject(reason), {
      once: true,
    });
    document.body.appendChild(script);
  });

  return googleFeedbackApiPromise;
}

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type FeedbackStatus = "closed" | "loading" | "open";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type FeedbackLogEntry = {
  timestamp: number;
  bucketSuffix?: string;
  productData?: Record<string, string>;
  flow?: "submit";
  description?: string;
  status: "pending" | "loaded" | "error" | "closed";
  errorMessage?: string;
};

export class FeedbackController extends RootController {
  @field()
  accessor status: FeedbackStatus = "closed";

  @field({ deep: false })
  accessor entries: FeedbackLogEntry[] = [];

  readonly #env: Readonly<AppEnvironment>;

  constructor(
    controllerId: string,
    persistenceId: string,
    env: Readonly<AppEnvironment>
  ) {
    super(controllerId, persistenceId);
    this.#env = env;

    if (typeof window !== "undefined") {
      window.addEventListener("securitypolicyviolation", (event) => {
        const url = event.blockedURI || "";
        if (
          url.includes("google.com/tools/feedback") ||
          url.includes("support.google.com") ||
          url.includes("feedback")
        ) {
          const lastEntry = this.entries[this.entries.length - 1];
          if (
            lastEntry &&
            (lastEntry.status === "pending" ||
              lastEntry.status === "loaded" ||
              lastEntry.status === "closed") // Catch it even if closed callback raced
          ) {
            const newEntries = [...this.entries];
            const idx = newEntries.length - 1;
            const existingMsg = newEntries[idx].errorMessage
              ? `${newEntries[idx].errorMessage}\n\n`
              : "";
            newEntries[idx] = {
              ...newEntries[idx],
              status: "error",
              errorMessage: `${existingMsg}CSP Violation: Loading '${url}' violates directive '${event.violatedDirective}'.`,
            };
            this.entries = newEntries;
          }
        }
      });
    }
  }

  /**
   * Opens the feedback flow.
   *
   * @param options Feedback options.
   * @param options.bucketSuffix Conceptually refines the default bucket.
   * If provided, it is appended to `GOOGLE_FEEDBACK_BUCKET` using an underscore
   * (e.g. producing "dev_opie" or "prod_opie").
   */
  async open(
    options: {
      bucketSuffix?: string;
      productData?: Record<string, string>;
      agentEvents?: Array<ReadonlyArray<AgentEvent>>;
    } & (
      | { flow?: undefined; description?: never }
      | { flow: "submit"; description: string }
    ) = {}
  ) {
    const LABEL = "Feedback.open";
    const logger = Utils.Logging.getLogger();

    const { bucketSuffix, productData, flow, agentEvents } = options;

    const finalProductData = { ...productData };
    if (agentEvents && agentEvents.length > 0) {
      const formattedConversations = agentEvents
        .map((events, index) => {
          const formatted = formatAgentEventHistory(events, 20);
          return agentEvents.length > 1
            ? `=== Agent Session #${index + 1} ===\n${formatted}`
            : formatted;
        })
        .join("\n\n");
      finalProductData.conversation = formattedConversations;
    }
    const description = "description" in options ? options.description : undefined;

    if (this.status !== "closed") {
      return;
    }

    const entryIndex = this.entries.length;
    this.entries = [
      ...this.entries,
      {
        timestamp: Date.now(),
        bucketSuffix,
        productData: finalProductData,
        flow,
        description,
        status: "pending",
      },
    ];

    const updateEntryStatus: (
      status: FeedbackLogEntry["status"],
      errorMessage?: string
    ) => void = (status, errorMessage) => {
      const newEntries = [...this.entries];
      if (newEntries[entryIndex]) {
        newEntries[entryIndex] = {
          ...newEntries[entryIndex],
          status,
          ...(errorMessage ? { errorMessage } : {}),
        };
        this.entries = newEntries;
      }
    };

    if (!this.#env) {
      logger.log(
        Utils.Logging.Formatter.error("No environment was provided."),
        LABEL
      );
      updateEntryStatus("error", "No environment was provided.");
      return;
    }
    const productId = this.#env.deploymentConfig.GOOGLE_FEEDBACK_PRODUCT_ID;
    if (!productId) {
      logger.log(
        Utils.Logging.Formatter.error(
          "No GOOGLE_FEEDBACK_PRODUCT_ID was set in the client deployment configuration."
        ),
        LABEL
      );
      updateEntryStatus("error", "No GOOGLE_FEEDBACK_PRODUCT_ID was set in the client deployment configuration.");
      return;
    }
    const baseBucket = this.#env.deploymentConfig.GOOGLE_FEEDBACK_BUCKET;
    const bucket = (baseBucket && bucketSuffix)
      ? `${baseBucket}_${bucketSuffix}`
      : (bucketSuffix || baseBucket);
    if (!bucket) {
      logger.log(
        Utils.Logging.Formatter.error(
          "No GOOGLE_FEEDBACK_BUCKET was set in the client deployment configuration."
        ),
        LABEL
      );
      updateEntryStatus("error", "No GOOGLE_FEEDBACK_BUCKET was set in the client deployment configuration.");
      return;
    }
    const { packageJsonVersion: version, gitCommitHash } = this.#env.buildInfo;

    const isSilent = flow === "submit";

    if (!isSilent) {
      this.status = "loading";
      this.#env.shellHost.setOneGoogleBarVisible(false);
    }

    let api;
    try {
      api = await loadGoogleFeedbackApi();
    } catch (e) {
      /* c8 ignore next 4 */
      const msg = e instanceof Error ? e.message : String(e);
      logger.log(
        Utils.Logging.Formatter.error(
          "Error loading Google Feedback script:",
          e
        ),
        LABEL
      );
      updateEntryStatus("error", `Error loading Google Feedback script: ${msg}`);
      if (!isSilent) {
        this.status = "closed";
        this.#env.shellHost.setOneGoogleBarVisible(true);
      }
      return;
    }

    if (!isSilent && this.status !== "loading") {
      /* c8 ignore next 4 */
      // The user might have pressed Escape on the loading panel in the
      // meantime.
      updateEntryStatus("closed", "Cancelled by user during load.");
      return;
    }

    const config: Parameters<UserFeedbackApi["startFeedback"]>[0] = {
      productId,
      bucket,
      productVersion: `${version} (${gitCommitHash})`,
    };

    if (isSilent && (!description || description.trim() === "")) {
      const msg = "Headless feedback submission requires a valid 'description'.";
      logger.log(Utils.Logging.Formatter.error(msg), LABEL);
      updateEntryStatus("error", msg);
      return;
    }

    if (description) {
      config.report = { description };
    }

    if (isSilent) {
      config.flow = "submit";
      updateEntryStatus("loaded");
    } else {
      config.onLoadCallback = () => {
        // Note that the API we loaded earlier is very tiny. This startFeedback
        // call is what actually loads most of the JavaScript, so we want to
        // keep the loading indicator visible until this callback fires.
        this.status = "open";
        updateEntryStatus("loaded");
      };
      config.callback = () => {
        this.status = "closed";
        this.#env.shellHost.setOneGoogleBarVisible(true);
        updateEntryStatus("closed");
      };
    }

    try {
      api.startFeedback(config, finalProductData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateEntryStatus("error", `Error starting feedback: ${msg}`);
    }
  }

  close() {
    this.status = "closed";
    this.#env.shellHost.setOneGoogleBarVisible(true);
    // Find the last pending/loaded entry and mark it closed
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry && (lastEntry.status === "pending" || lastEntry.status === "loaded")) {
      const newEntries = [...this.entries];
      newEntries[newEntries.length - 1] = {
        ...lastEntry,
        status: "closed",
      };
      this.entries = newEntries;
    }
  }
}

function formatLLMContent(content: LLMContent): string {
  if (!content || !content.parts) return "";
  return content.parts
    .map((part) => {
      if ("text" in part) {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatAgentEventHistory(
  events: ReadonlyArray<AgentEvent>,
  n = 20
): string {
  const lastN = events.slice(-n);
  return lastN
    .map((event) => {
      const type = eventType(event);
      const payload = eventPayload(event);

      switch (type) {
        case "start": {
          const p = payload as Payload<"start">;
          return `START OBJECTIVE:\n${formatLLMContent(p.objective)}`;
        }
        case "thought": {
          const p = payload as Payload<"thought">;
          return `THOUGHT:\n${p.text}`;
        }
        case "functionCall": {
          const p = payload as Payload<"functionCall">;
          return `CALL TOOL: ${p.name}\nArgs: ${JSON.stringify(p.args)}`;
        }
        case "functionResult": {
          const p = payload as Payload<"functionResult">;
          return `TOOL RESULT: ${formatLLMContent(p.content)}`;
        }
        case "content": {
          const p = payload as Payload<"content">;
          return `MODEL:\n${formatLLMContent(p.content)}`;
        }
        case "waitForInput": {
          const p = payload as Payload<"waitForInput">;
          return `WAIT FOR INPUT:\n${formatLLMContent(p.prompt)}`;
        }
        case "waitForChoice": {
          const p = payload as Payload<"waitForChoice">;
          const choicesStr = p.choices
            .map((c) => formatLLMContent(c.content))
            .join(" | ");
          return `WAIT FOR CHOICE:\n${formatLLMContent(p.prompt)}\nChoices: ${choicesStr}`;
        }
        case "applyEdits": {
          const p = payload as Payload<"applyEdits">;
          return `APPLY EDITS: ${p.label}`;
        }
        case "error": {
          const p = payload as Payload<"error">;
          return `ERROR: ${p.message}`;
        }
        case "complete": {
          const p = payload as Payload<"complete">;
          return `COMPLETE:\n${JSON.stringify(p.result)}`;
        }
        default:
          return `${type.toUpperCase()} EVENT`;
      }
    })
    .join("\n---\n");
}
