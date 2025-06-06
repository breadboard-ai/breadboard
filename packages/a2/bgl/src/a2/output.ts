/**
 * @fileoverview Provides an output helper.
 */

import output from "@output";
import write from "@write";

import { generateId, ok } from "./utils";

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

export { report, StreamableReporter };

const MIME_TYPE = "application/vnd.breadboard.report-stream";

class StreamableReporter {
  public readonly path: FileSystemReadWritePath = `/run/reporter/stream/${generateId()}`;
  #started = false;

  constructor(public readonly options: NodeMetadata) {}

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
    return output({ schema, $metadata, reportStream });
  }

  async reportLLMContent(llmContent: LLMContent) {
    if (!this.#started) {
      console.log("StreamableReporter not started: call `start()` first");
      return;
    }
    const data = [llmContent];
    return write({ path: this.path, stream: true, data });
  }

  report(json: JsonSerializable) {
    return this.reportLLMContent({ parts: [{ json }] });
  }

  sendUpdate(title: string, body: unknown | undefined) {
    let bodyParticle;
    if (body && typeof body == "object" && "parts" in body) {
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
    return this.report({
      type: "update",
      group: [
        ["title", { text: title }],
        ["body", bodyParticle],
      ],
    });
  }

  async sendError(error: { $error: string }) {
    await this.report({
      type: "update",
      group: [
        ["title", { text: "Error" }],
        ["body", { text: error.$error }],
      ],
    });
    return error;
  }

  close() {
    if (!this.#started) return;
    return write({ path: this.path, stream: true, done: true });
    this.#started = false;
  }
}

async function report(inputs: ReportInputs): Promise<boolean> {
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
