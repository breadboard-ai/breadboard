/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { describeContent };

/**
 * The describer for the "Content" component.
 */
function describeContent(inputs) {
  const { template } = inputs;
  const params = unique([...collectParams(textFromLLMContent(template))]);

  const props = Object.fromEntries(
    params.map((param) => [
      toId(param),
      {
        title: toTitle(param),
        description: `The value to substitute for the parameter "${param}"`,
        type: "string",
      },
    ])
  );

  const $inputSchema = {
    properties: {
      context: {
        type: "array",
        title: "Context in",
        examples: [],
        items: {
          type: "object",
          behavior: ["llm-content"],
        },
        default: '[{"role":"user","parts":[{"text":""}]}]',
        description: "The optional incoming conversation context",
      },
      template: {
        type: "object",
        title: "Text",
        examples: [],
        behavior: ["llm-content", "config"],
        default: "null",
        description:
          "(Optional) The text that will initialize or be added to existing conversation context. Use mustache-style {{params}} to add parameters.",
      },
    },
    type: "object",
    required: [],
  };

  const $outputSchema = {
    type: "object",
    properties: {
      context: {
        type: "array",
        title: "Context out",
        examples: [],
        items: {
          type: "object",
          behavior: ["llm-content"],
        },
        description:
          "The resulting context, created from the template and parameters.",
      },
    },
    required: [],
  };

  const required = params.map(toId);

  return mergeSchemas($inputSchema, $outputSchema, props);

  function mergeSchemas(inputSchema, outputSchema, properties) {
    return {
      inputSchema: {
        ...inputSchema,
        properties: {
          ...inputSchema.properties,
          ...properties,
        },
        required: [...(inputSchema.required || []), ...required],
      },
      outputSchema: outputSchema,
    };
  }

  function toId(param) {
    return `p-${param}`;
  }

  function toTitle(id) {
    const spaced = id?.replace(/[_-]/g, " ");
    return (
      (spaced?.at(0)?.toUpperCase() ?? "") +
      (spaced?.slice(1)?.toLowerCase() ?? "")
    );
  }

  function textFromLLMContent(content) {
    return content?.parts.map((item) => item.text).join("\n") || "";
  }

  function unique(params) {
    return Array.from(new Set(params));
  }

  function collectParams(text) {
    if (!text) return [];
    const matches = text.matchAll(/{{(?<name>[\w-]+)}}/g);
    return Array.from(matches).map((match) => match.groups?.name || "");
  }
}
