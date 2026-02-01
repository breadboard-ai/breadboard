/**
 * @fileoverview Provides an output helper.
 */

import {
  AppScreen,
  Capabilities,
  ConsoleEntry,
  JsonSerializable,
  LLMContent,
  NodeMetadata,
  Schema,
} from "@breadboard-ai/types";
import { ErrorMetadata } from "./utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

type ReportInputs = {
  /**
   * The name of the actor providing the report
   */
  actor: string;
  /**
   * The general category of the report
   */
  category: string;
  /**
   * The name of the report
   */
  name: string;
  /**
   * The details of the report
   */
  details: string | LLMContent;
  /**
   * The icon to use
   */
  icon?: string;
  /**
   * Whether or not this is part of interacting
   * with the user
   */
  chat?: boolean;
};

export type Link = {
  uri: string;
  title: string;
  iconUri: string;
};

export { report, StreamableReporter, getCurrentStepState };

export type Hints = {
  /**
   * Provides presentation hints. If not specified, the group particle doesn't
   * have an opinion about its type (think "generic grouping").
   * If specified, can be used to identify semantics. For example, can be used
   * to bind to the right UI element.
   */
  presentation?: PresentationHint[];
  /**
   * Provides behavior hints. If not specified, the group particle is just
   * static content. Otherwise, the group particle has event listeners
   * (behaviors) attached to it.
   */
  behaviors?: BehaviorHint[];
};

export type TextParticle = {
  /**
   * Content of the particle.
   */
  text: string;
  /**
   * The type of the content. If omitted, "text/markdown" is assumed.
   */
  mimeType?: string;
} & Hints;

export type DataParticle = {
  /**
   * A URL that points to the data.
   */
  data: string;
  /**
   * The type of the data.
   */
  mimeType: string;
} & Hints;

export type GroupParticle = {
  /**
   * The sub-particles that are part of this group.
   * The Map structure is key for reactive updates.
   */
  group: Map<ParticleIdentifier, Particle>;
  /**
   * The type of a group. Allows the particle to be bound to a particular
   * UI element. Optional. If not specified, the group particle doesn't have
   * an opinion about its type (think "generic grouping").
   * If specified, can be used to identify semantics. For example, can be used
   * to bind to the right custom element.
   */
  type?: string;
} & Hints;

export type PresentationHint = string;
export type BehaviorHint = string;

export type Particle = TextParticle | DataParticle | GroupParticle;

export type ParticleIdentifier = string;

/**
 * The basics of Semantic UI Protocol (SUIP)
 */

export type SerializedParticle =
  | TextParticle
  | DataParticle
  | SerializedGroupParticle;

export type SerializedGroupParticle = {
  type?: ParticleIdentifier;
  group: [key: string, value: SerializedParticle][];
};

export type JsonRpcNotification<Method extends string, Params> = {
  jsonrpc: "2.0";
  method: Method;
  params: Params;
};

/**
 * Append, Insert, or Replace operation:
 * - when the `path` and `id` match an existing particle, the existing particle
 *   will be replaced with provided particle.
 * - when the `path` and `id` do not match a particle and `before` isn't
 *   specified, the new particle will be appended.
 * - when the `path` and `id` do not match a particle and `before` matches id of
 *   an existing peer particle, new particle will be appended before the it.
 */
export type ParticleUpsertOperation = JsonRpcNotification<
  "suip/ops/upsert",
  {
    /**
     * Path to the parent of the newly added particle.
     */
    path: ParticleIdentifier[];
    /**
     * The id of the particle to add.
     */
    id: ParticleIdentifier;
    /**
     * The particle to add.
     */
    particle: SerializedParticle;
    /**
     * The peer particle id before which to insert the new particle.
     * If not specified or null, the particle will be appended at the end.
     */
    before?: ParticleIdentifier | null;
  }
>;

export type ParticleRemoveOperation = JsonRpcNotification<
  "suip/ops/remove",
  {
    path: string[];
  }
>;

export type ParticleOperation =
  | ParticleUpsertOperation
  | ParticleRemoveOperation;

import { ProgressWorkItem } from "../agent/progress-work-item.js";

class StreamableReporter {
  readonly #progressWorkItem: ProgressWorkItem;
  readonly #consoleEntry: ConsoleEntry | undefined;

  constructor(
    moduleArgs: A2ModuleArgs,
    public readonly options: NodeMetadata
  ) {
    const { consoleEntry, appScreen } = getCurrentStepState(moduleArgs);
    this.#consoleEntry = consoleEntry;
    this.#progressWorkItem = new ProgressWorkItem(
      options.title ?? "Progress",
      options.icon ?? "info",
      appScreen
    );
    if (this.#consoleEntry) {
      this.#consoleEntry.work.set(crypto.randomUUID(), this.#progressWorkItem);
    }
  }

  async start() {
    // No-op: ProgressWorkItem is created in constructor
  }

  #toLLMContent(body: unknown): LLMContent {
    if (!body) {
      return { parts: [{ text: "Empty content" }] };
    }
    if (typeof body === "string") {
      return { parts: [{ text: body }] };
    }
    if (typeof body === "object" && "parts" in body) {
      return body as LLMContent;
    }
    return { parts: [{ json: body as JsonSerializable }] };
  }

  sendLinks(title: string, links: Link[], icon?: string) {
    // Pass structured link data to addLinks
    this.#progressWorkItem.addLinks(title, icon ?? "link", links);
  }

  displayA2UI(title: string, body: unknown, icon?: string) {
    // Extract ServerToClientMessage array from the body
    // Body is expected to be LLMContent[] where each part.json is a message
    const messages = this.#extractA2UIMessages(body);
    if (messages.length > 0) {
      this.#progressWorkItem.addA2UI(messages);
    } else {
      // Fallback to text display if we can't parse messages
      this.#progressWorkItem.addUpdate(
        title,
        icon ?? "web",
        this.#toLLMContent(body)
      );
    }
  }

  #extractA2UIMessages(body: unknown): unknown[] {
    if (!Array.isArray(body)) return [];
    const messages: unknown[] = [];
    for (const content of body) {
      if (
        typeof content === "object" &&
        content !== null &&
        "parts" in content
      ) {
        const parts = (content as { parts: unknown[] }).parts;
        for (const part of parts) {
          if (typeof part === "object" && part !== null && "json" in part) {
            const json = (part as { json: unknown }).json;
            // If json is an array, flatten it (Gemini returns full array in one part)
            if (Array.isArray(json)) {
              messages.push(...json);
            } else {
              messages.push(json);
            }
          }
        }
      }
    }
    return messages;
  }

  sendUpdate(title: string, body: unknown | undefined, icon?: string) {
    this.#progressWorkItem.addUpdate(
      title,
      icon ?? "info",
      this.#toLLMContent(body)
    );
  }

  async sendError(error: { $error: string; metadata?: ErrorMetadata }) {
    this.#progressWorkItem.addUpdate("Error", "warning", {
      parts: [{ text: error.$error }],
    });
    return error;
  }

  close() {
    this.#progressWorkItem.end = performance.now();
  }
}

async function report(
  { output }: Capabilities,
  inputs: ReportInputs
): Promise<boolean> {
  const { actor: title, category: description, name, details, icon } = inputs;

  const detailsSchema: Schema =
    typeof details === "string"
      ? {
          title: name,
          type: "string",
          format: "markdown",
        }
      : {
          title: name,
          type: "object",
          behavior: ["llm-content"],
        };

  if (icon) {
    detailsSchema.icon = icon;
  }

  const schema: Schema = {
    type: "object",
    properties: {
      details: detailsSchema,
    },
  };

  const { delivered } = await output({
    $metadata: {
      title,
      description,
      icon,
    },
    schema,
    details,
  });
  return delivered;
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
