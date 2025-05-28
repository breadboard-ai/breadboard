/**
 * @fileoverview Provides an output helper.
 */

import output from "@output";

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

export { report };

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
