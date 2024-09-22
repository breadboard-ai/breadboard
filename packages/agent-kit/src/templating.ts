/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, LlmContent } from "./context.js";

export { substitute };

type SubstituteInputParams = {
  in?: Context[];
  persona?: LlmContent;
  task?: LlmContent;
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
