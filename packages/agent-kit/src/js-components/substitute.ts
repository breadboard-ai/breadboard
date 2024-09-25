/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, LlmContent } from "../context.js";
import type { FunctionDeclaration } from "../function-calling.js";
import type {
  Operation,
  ParamInfo,
  ParamLocationMap,
  TemplatePart,
} from "../templating.js";
import {
  isEmptyContent,
  isLLMContent,
  isLLMContentArray,
  toId,
  toTitle,
  unique,
} from "../util.js";

export type Inputs = {
  in?: Context[];
  persona?: LlmContent;
  task?: LlmContent;
  // TODO(aomarks) The following should be uncommented, but there's a typing
  // issue in the Build API that makes this not work. Needs investigation.
  // Doesn't make a huge difference, but will require some casting e.g. in
  // tests.
  //
  // [param: string]: unknown;
};

export type Outputs = {
  in: Context[];
  persona: LlmContent | string;
  task: LlmContent | string;
  outs: FunctionDeclaration[];
};

/**
 * Part of the "Specialist" v2 component that does the parameter
 * substitution.
 */
export function run(inputParams: Inputs): Outputs {
  const { in: context = [], persona, task, ...inputs } = inputParams;
  const personaParams = findParams(persona);
  const taskParams = findParams(task);
  const params = mergeParams(personaParams, taskParams);

  // Make sure that all params are present in the values and collect
  // them into a single object.
  const values = collectValues(params, inputs);

  if (context.length === 0 && !task) {
    throw new Error(
      "Both conversation Context and Task are empty. Specify at least one of them."
    );
  }

  return {
    in: context,
    persona: subContent(persona, values),
    task: subContent(task, values),
    outs: collectOuts(personaParams, taskParams),
  };
}

function collectOuts(...paramsList: ParamInfo[][]) {
  const functionNames = unique(
    paramsList
      .flat()
      .map((param) => {
        const { name, op } = param;
        if (op !== "out") return null;
        return name;
      })
      .filter(Boolean)
  ) as string[];
  return functionNames.map((name) => {
    const toolName = `TOOL_${name.toLocaleUpperCase()}`;
    return {
      name: toolName,
      description: `Call this function when asked to invoke the "${toolName}" tool.`,
    } satisfies FunctionDeclaration;
  });
}

function findParams(content: LlmContent | undefined): ParamInfo[] {
  const parts = content?.parts;
  if (!parts) return [];
  const results = parts.flatMap((part) => {
    if (!("text" in part)) return [] as ParamInfo[];
    const matches = part.text.matchAll(
      /{{\s*(?<name>[\w-]+)(?:\s*\|\s*(?<op>[\w-]*)(?::\s*"(?<arg>[\w-]+)")?)?\s*}}/g
    );
    return unique(Array.from(matches))
      .map((match) => {
        const name = match.groups?.name || "";
        const op = match.groups?.op || "";
        const arg = match.groups?.arg || "";
        if (!name) return null;
        return { name, op, arg, locations: [{ part, parts }] } as ParamInfo;
      })
      .filter(Boolean);
  }) as ParamInfo[];
  return results;
}

function mergeParams(...paramList: ParamInfo[][]) {
  const result = paramList.reduce((acc, params) => {
    for (const param of params) {
      if (param.op && param.op !== "in") {
        continue;
      }
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
  return result;
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
  if (isEmptyContent(content)) return "";
  return {
    role: content.role || "user",
    parts: mergeTextParts(
      splitToTemplateParts(content).flatMap((part) => {
        if ("param" in part) {
          const { op = "in" } = part;
          if (op === "in") {
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
            return { text: `"TOOL_${part.param.toLocaleUpperCase()}"` };
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

/**
 * Takes an LLM Content and splits it further into parts where
 * each {{param}} substitution is a separate part.
 */
function splitToTemplateParts(content: LlmContent): TemplatePart[] {
  const parts: TemplatePart[] = [];
  for (const part of content.parts) {
    if (!("text" in part)) {
      parts.push(part);
      continue;
    }
    const matches = part.text.matchAll(
      /{{\s*(?<name>[\w-]+)(?:\s*\|\s*(?<op>[\w-]*)(?::\s*"(?<arg>[\w-]+)")?)?\s*}}/g
    );
    let start = 0;
    for (const match of matches) {
      const name = match.groups?.name || "";
      const op = match.groups?.op as Operation;
      const arg = match.groups?.arg;
      const end = match.index;
      if (end > start) {
        parts.push({ text: part.text.slice(start, end) });
      }
      parts.push({ param: name, op, arg });
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
