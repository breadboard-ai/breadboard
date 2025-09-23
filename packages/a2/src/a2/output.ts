/**
 * @fileoverview Provides an output helper.
 */

import { ErrorMetadata, generateId, ok } from "./utils";

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
};

export { report, StreamableReporter };

const MIME_TYPE = "application/vnd.breadboard.report-stream";

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

class StreamableReporter {
  public readonly path: FileSystemReadWritePath = `/run/reporter/stream/${generateId()}`;
  #started = false;
  #id = 0;

  constructor(
    private readonly caps: Capabilities,
    public readonly options: NodeMetadata
  ) {}

  async start() {
    if (this.#started) return;
    this.#started = true;

    const schema: Schema = {
      type: "object",
      properties: {
        reportStream: {
          behavior: ["llm-content"],
          type: "object",
        },
      },
    };
    const $metadata = this.options;
    const reportStream: LLMContent = {
      parts: [{ fileData: { fileUri: this.path, mimeType: MIME_TYPE } }],
    };
    const starting = await this.report("start");
    if (!ok(starting)) return starting;
    return this.caps.output({ schema, $metadata, reportStream });
  }

  async reportLLMContent(llmContent: LLMContent) {
    if (!this.#started) {
      console.log("StreamableReporter not started: call `start()` first");
      return;
    }
    const data = [llmContent];
    return this.caps.write({ path: this.path, stream: true, data });
  }

  report(json: JsonSerializable) {
    return this.reportLLMContent({ parts: [{ json }] });
  }

  #sendOperation(op: ParticleOperation) {
    return this.report(op);
  }

  #sendUpsert(params: ParticleUpsertOperation["params"]) {
    return this.#sendOperation({
      jsonrpc: "2.0",
      method: "suip/ops/upsert",
      params,
    });
  }

  sendLinks(title: string, links: Link[], icon?: string) {
    const group: SerializedGroupParticle["group"] = [
      ["title", { text: title }],
      [
        "links",
        {
          text: JSON.stringify(links),
          mimeType: "application/json",
        },
      ],
    ];
    if (icon) {
      group.push(["icon", { text: icon }]);
    }
    return this.#sendUpsert({
      path: ["console"],
      id: `${this.#id++}`,
      particle: { type: "links", group },
    });
  }

  sendUpdate(title: string, body: unknown | undefined, icon?: string) {
    let bodyParticle;
    if (!body) {
      bodyParticle = { text: "Empty content" };
    } else if (typeof body === "string") {
      bodyParticle = { text: body };
    } else if (typeof body === "object" && "parts" in body) {
      bodyParticle = {
        text: JSON.stringify(body),
        mimeType: "application/vnd.breadboard.llm-content",
      };
    } else {
      bodyParticle = {
        text: JSON.stringify(body),
        mimeType: "application/json",
      };
    }
    const group: SerializedGroupParticle["group"] = [
      ["title", { text: title }],
      ["body", bodyParticle],
    ];
    if (icon) {
      group.push(["icon", { text: icon }]);
    }
    return this.#sendUpsert({
      path: ["console"],
      id: `${this.#id++}`,
      particle: { type: "update", group },
    });
  }

  async sendError(error: { $error: string; metadata?: ErrorMetadata }) {
    await this.#sendUpsert({
      path: ["console"],
      id: `${this.#id}`,
      particle: {
        type: "update",
        group: [
          ["title", { text: "Error" }],
          ["body", { text: error.$error }],
          ["icon", { text: "warning" }],
        ],
      },
    });
    return error;
  }

  close() {
    if (!this.#started) return;
    return this.caps.write({ path: this.path, stream: true, done: true });
    this.#started = false;
  }
}

async function report(
  { output }: Capabilities,
  inputs: ReportInputs
): Promise<boolean> {
  const {
    actor: title,
    category: description,
    name,
    details,
    icon,
    chat,
  } = inputs;

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

  if (chat) {
    detailsSchema.behavior?.push("hint-chat-mode");
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
