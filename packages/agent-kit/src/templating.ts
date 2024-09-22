/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@google-labs/breadboard";
import { Context, LlmContent } from "./context.js";

export { substitute, describeSpecialist, content };

type SubstituteInputParams = {
  in?: Context[];
  persona?: LlmContent;
  task?: LlmContent;
  [param: string]: unknown;
};

type Location = {
  part: LlmContent;
  parts: LlmContent[];
};

type ParamLocationMap = Record<string, Location[]>;

type ParamInfo = {
  name: string;
  locations: Location[];
};

type TemplatePart = LlmContent["parts"][0] | { param: string };

type SpecialistDescriberInputs = {
  $inputSchema: Schema;
  $outputSchema: Schema;
  persona?: LlmContent;
  task?: LlmContent;
};

type ContentInputs = {
  template: LlmContent;
  context?: LlmContent[];
  [param: string]: unknown;
};

/**
 * Part of the "Specialist" v2 component that does the parameter
 * substitution.
 */
function substitute(inputParams: SubstituteInputParams) {
  const { in: context = [], persona, task, ...inputs } = inputParams;
  const params = mergeParams(findParams(persona), findParams(task));

  // Make sure that all params are present in the values and collect
  // them into a single object.
  const values = collectValues(params, inputs);

  if (context.length === 0 && !task) {
    throw new Error(
      "Both conversation context and task are empty. Specify at least one of them."
    );
  }

  return {
    in: context,
    persona: subContent(persona, values),
    task: subContent(task, values),
  };

  function unique<T>(params: T[]): T[] {
    return Array.from(new Set(params));
  }

  function toId(param: string) {
    return `p-${param}`;
  }

  function findParams(content: LlmContent | undefined): ParamInfo[] {
    const parts = content?.parts;
    if (!parts) return [];
    const results = parts.flatMap((part) => {
      if (!("text" in part)) return [];
      const matches = part.text.matchAll(/{{(?<name>[\w-]+)}}/g);
      return unique(Array.from(matches))
        .map((match) => {
          const name = match.groups?.name || "";
          if (!name) return null;
          return { name, locations: [{ part, parts }] };
        })
        .filter(Boolean);
    }) as unknown as ParamInfo[];
    return results;
  }

  function mergeParams(...paramList: ParamInfo[][]) {
    return paramList.reduce((acc, params) => {
      for (const param of params) {
        const { name, locations } = param;
        const existing = acc[name];
        if (existing) {
          existing.push(...locations);
        } else {
          acc[name] = locations;
        }
      }
      return acc;
    }, {} as ParamLocationMap);
  }

  function subContent(
    content: LlmContent | undefined,
    values: Record<string, unknown>
  ): LlmContent | string {
    // If this is an array, optimistically presume this is an LLM Content array.
    // Take the last item and use it as the content.
    if (Array.isArray(content)) {
      content = content.at(-1);
    }
    if (!content) return "";
    return {
      role: content.role || "user",
      parts: mergeTextParts(
        splitToTemplateParts(content).flatMap((part) => {
          if ("param" in part) {
            const value = values[part.param];
            if (typeof value === "string") {
              return { text: value };
            } else if (isLLMContent(value)) {
              return value.parts;
            } else if (isLLMContentArray(value)) {
              const last = value.at(-1);
              return last ? last.parts : [];
            } else {
              return { text: JSON.stringify(value) };
            }
          } else {
            return part;
          }
        })
      ),
    };
  }

  function mergeTextParts(parts: TemplatePart[]) {
    const merged = [];
    for (const part of parts) {
      if ("text" in part) {
        const last = merged[merged.length - 1];
        if (last && "text" in last) {
          last.text += part.text;
        } else {
          merged.push(part);
        }
      } else {
        merged.push(part);
      }
    }
    return merged as LlmContent["parts"];
  }

  function toTitle(id: string) {
    const spaced = id?.replace(/[_-]/g, " ");
    return (
      (spaced?.at(0)?.toUpperCase() ?? "") +
      (spaced?.slice(1)?.toLowerCase() ?? "")
    );
  }

  /**
   * Takes an LLM Content and splits it further into parts where
   * each {{param}} substitution is a separate part.
   */
  function splitToTemplateParts(content: LlmContent): TemplatePart[] {
    const parts = [];
    for (const part of content.parts) {
      if (!("text" in part)) {
        parts.push(part);
        continue;
      }
      const matches = part.text.matchAll(/{{(?<name>[\w-]+)}}/g);
      let start = 0;
      for (const match of matches) {
        const name = match.groups?.name || "";
        const end = match.index;
        if (end > start) {
          parts.push({ text: part.text.slice(start, end) });
        }
        parts.push({ param: name });
        start = end + match[0].length;
      }
      if (start < part.text.length) {
        parts.push({ text: part.text.slice(start) });
      }
    }
    return parts;
  }

  function collectValues(
    params: ParamLocationMap,
    inputs: Record<string, unknown>
  ) {
    const values: Record<string, unknown> = {};
    for (const param in params) {
      const id = toId(param);
      const value = inputs[id];
      if (!value) {
        const title = toTitle(param);
        throw new Error(`Missing required parameter: ${title}`);
      }
      values[param] = value;
    }
    return values;
  }

  /**
   * Copied from @google-labs/breadboard
   */
  function isLLMContent(nodeValue: unknown): nodeValue is LlmContent {
    if (typeof nodeValue !== "object" || !nodeValue) return false;
    if (nodeValue === null || nodeValue === undefined) return false;

    return "parts" in nodeValue && Array.isArray(nodeValue.parts);
  }

  function isLLMContentArray(nodeValue: unknown): nodeValue is LlmContent[] {
    if (!Array.isArray(nodeValue)) return false;
    if (nodeValue.length === 0) return true;
    return isLLMContent(nodeValue.at(-1));
  }
}

/**
 * The describer for the "Specialist" v2 component.
 */
function describeSpecialist(inputs: unknown) {
  const { $inputSchema, $outputSchema, persona, task } =
    inputs as SpecialistDescriberInputs;

  const inputSchema: Schema = {
    type: "object",
    properties: {
      ...$inputSchema.properties,
      in: {
        title: "Context in",
        description: "Incoming conversation context",
        type: "array",
        items: {
          type: "object",
          behavior: ["llm-content"],
        },
        examples: [],
      },
      task: {
        title: "Task",
        description:
          "(Optional) Provide a specific task with clear instructions for the worker to complete using the conversation context. Use mustache-style {{params}} to add parameters.",
        type: "object",
        default: '{"role":"user","parts":[{"text":""}]}',
        behavior: ["llm-content", "config"],
        examples: [],
      },
      persona: {
        type: "object",
        behavior: ["llm-content", "config"],
        title: "Persona",
        description:
          "Describe the worker's skills, capabilities, mindset, and thinking process. Use mustache-style {{params}} to add parameters.",
        default: '{"role":"user","parts":[{"text":""}]}',
        examples: [],
      },
    },
    required: [],
  };

  const params = unique([
    ...collectParams(textFromLLMContent(persona)),
    ...collectParams(textFromLLMContent(task)),
  ]);

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

  const required = params.map(toId);

  return mergeSchemas(inputSchema, $outputSchema, props);

  function mergeSchemas(
    inputSchema: Schema,
    outputSchema: Schema,
    properties: Record<string, Schema>
  ) {
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

  function toId(param: string) {
    return `p-${param}`;
  }

  function toTitle(id: string) {
    const spaced = id?.replace(/[_-]/g, " ");
    return (
      (spaced?.at(0)?.toUpperCase() ?? "") +
      (spaced?.slice(1)?.toLowerCase() ?? "")
    );
  }

  function textFromLLMContent(content: LlmContent | undefined) {
    return (
      content?.parts
        .map((item) => {
          return "text" in item ? item.text : "";
        })
        .join("\n") || ""
    );
  }

  function unique<T>(params: T[]): T[] {
    return Array.from(new Set(params));
  }

  function collectParams(text: string) {
    if (!text) return [];
    const matches = text.matchAll(/{{(?<name>[\w-]+)}}/g);
    return Array.from(matches).map((match) => match.groups?.name || "");
  }
}

/**
 * The guts of the "Content" component.
 */
function content(starInputs: unknown) {
  const { template, context, ...inputs } = starInputs as ContentInputs;
  const params = mergeParams(findParams(template));
  const values = collectValues(params, inputs);

  return {
    context: prependContext(context, subContent(template, values)),
  };

  function prependContext(
    context: LlmContent[] | undefined,
    c: LlmContent | string
  ): LlmContent[] {
    const content = (isEmptyContent(c) ? [] : [c]) as LlmContent[];
    if (!context) return [...content] as LlmContent[];
    if (isLLMContentArray(context)) {
      // If the last item in the context has a user rule,
      // merge the new content with it instead of creating a new item.
      const last = context.at(-1);
      if (last && last.role === "user") {
        return [
          ...context.slice(0, -1),
          {
            role: "user",
            parts: [
              ...last.parts,
              ...((content.at(0) as LlmContent)?.parts || []),
            ],
          },
        ];
      }
      return [...context, ...content] as LlmContent[];
    }
    return content;
  }

  function isEmptyContent(content: LlmContent | string | undefined) {
    if (!content) return true;
    if (typeof content === "string") return true;
    if (!content.parts?.length) return true;
    if (content.parts.length > 1) return false;
    const part = content.parts[0];
    if (!("text" in part)) return true;
    if (part.text.trim() === "") return true;
    return false;
  }

  function subContent(
    content: LlmContent | undefined,
    values: Record<string, unknown>
  ): LlmContent | string {
    // If this is an array, optimistically presume this is an LLM Content array.
    // Take the last item and use it as the content.
    if (Array.isArray(content)) {
      content = content.at(-1);
    }
    if (!content) return "";
    return {
      role: content.role || "user",
      parts: mergeTextParts(
        splitToTemplateParts(content).flatMap((part) => {
          if ("param" in part) {
            const value = values[part.param];
            if (typeof value === "string") {
              return { text: value };
            } else if (isLLMContent(value)) {
              return value.parts;
            } else if (isLLMContentArray(value)) {
              const last = value.at(-1);
              return last ? last.parts : [];
            } else {
              return { text: JSON.stringify(value) };
            }
          } else {
            return part;
          }
        })
      ),
    };
  }

  function findParams(content: LlmContent | undefined): ParamInfo[] {
    const parts = content?.parts;
    if (!parts) return [];
    const results = parts.flatMap((part) => {
      if (!("text" in part)) return [];
      const matches = part.text.matchAll(/{{(?<name>[\w-]+)}}/g);
      return unique(Array.from(matches))
        .map((match) => {
          const name = match.groups?.name || "";
          if (!name) return null;
          return { name, locations: [{ part, parts }] };
        })
        .filter(Boolean);
    }) as unknown as ParamInfo[];
    return results;
  }

  function mergeParams(...paramList: ParamInfo[][]) {
    return paramList.reduce((acc, params) => {
      for (const param of params) {
        const { name, locations } = param;
        const existing = acc[name];
        if (existing) {
          existing.push(...locations);
        } else {
          acc[name] = locations;
        }
      }
      return acc;
    }, {} as ParamLocationMap);
  }

  function unique<T>(params: T[]): T[] {
    return Array.from(new Set(params));
  }

  function mergeTextParts(parts: TemplatePart[]) {
    const merged = [];
    for (const part of parts) {
      if ("text" in part) {
        const last = merged[merged.length - 1];
        if (last && "text" in last) {
          last.text += part.text;
        } else {
          merged.push(part);
        }
      } else {
        merged.push(part);
      }
    }
    return merged as LlmContent["parts"];
  }

  function toId(param: string) {
    return `p-${param}`;
  }

  function toTitle(id: string) {
    const spaced = id?.replace(/[_-]/g, " ");
    return (
      (spaced?.at(0)?.toUpperCase() ?? "") +
      (spaced?.slice(1)?.toLowerCase() ?? "")
    );
  }

  /**
   * Takes an LLM Content and splits it further into parts where
   * each {{param}} substitution is a separate part.
   */
  function splitToTemplateParts(content: LlmContent): TemplatePart[] {
    const parts = [];
    for (const part of content.parts) {
      if (!("text" in part)) {
        parts.push(part);
        continue;
      }
      const matches = part.text.matchAll(/{{(?<name>[\w-]+)}}/g);
      let start = 0;
      for (const match of matches) {
        const name = match.groups?.name || "";
        const end = match.index;
        if (end > start) {
          parts.push({ text: part.text.slice(start, end) });
        }
        parts.push({ param: name });
        start = end + match[0].length;
      }
      if (start < part.text.length) {
        parts.push({ text: part.text.slice(start) });
      }
    }
    return parts;
  }

  function collectValues(
    params: ParamLocationMap,
    inputs: Record<string, unknown>
  ) {
    const values: Record<string, unknown> = {};
    for (const param in params) {
      const id = toId(param);
      const value = inputs[id];
      if (!value) {
        const title = toTitle(param);
        throw new Error(`Missing required parameter: ${title}`);
      }
      values[param] = value;
    }
    return values;
  }

  /**
   * Copied from @google-labs/breadboard
   */
  function isLLMContent(nodeValue: unknown): nodeValue is LlmContent {
    if (typeof nodeValue !== "object" || !nodeValue) return false;
    if (nodeValue === null || nodeValue === undefined) return false;

    return "parts" in nodeValue && Array.isArray(nodeValue.parts);
  }

  function isLLMContentArray(nodeValue: unknown): nodeValue is LlmContent[] {
    if (!Array.isArray(nodeValue)) return false;
    if (nodeValue.length === 0) return true;
    return isLLMContent(nodeValue.at(-1));
  }
}
