/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { substitute };

function substitute({ in: context, persona, task, ...inputs }) {
  const params = mergeParams(findParams(persona), findParams(task));

  // Make sure that all params are present in the values and collect
  // them into a single object.
  const values = {};
  for (const param in params) {
    const id = toId(param);
    const value = inputs[id];
    if (!value) {
      const title = toTitle(param);
      throw new Error(`Missing required parameter: ${title}`);
    }
    values[param] = value;
  }

  return {
    in: context,
    persona: subContent(persona, values),
    task: subContent(task, values),
  };

  function unique(params) {
    return Array.from(new Set(params));
  }

  function toId(param) {
    return `p-${param}`;
  }

  function findParams(content) {
    const parts = content?.parts;
    if (!parts) return [];
    const results = parts.flatMap((part) => {
      const matches = part.text.matchAll(/{{(?<name>[\w-]+)}}/g);
      return unique(Array.from(matches))
        .map((match) => {
          const name = match.groups?.name || "";
          if (!name) return null;
          return { name, locations: [{ part, parts }] };
        })
        .filter(Boolean);
    });
    return results;
  }

  function mergeParams(...paramList) {
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
    }, {});
  }

  function subContent(content, values) {
    return {
      parts: mergeTextParts(
        splitToTemplateParts(content).flatMap((part) => {
          if (part.param) {
            const value = values[part.param];
            if (typeof value === "string") {
              return { text: value };
            } else if (isLLMContent(value)) {
              return value.parts;
            } else if (isLLMContentArray(value)) {
              const last = value.at(-1);
              return last.parts;
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

  function mergeTextParts(parts) {
    const merged = [];
    for (const part of parts) {
      if (part.text) {
        const last = merged[merged.length - 1];
        if (last?.text) {
          last.text += part.text;
        } else {
          merged.push(part);
        }
      } else {
        merged.push(part);
      }
    }
    return merged;
  }

  function toTitle(id) {
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
  function splitToTemplateParts(content) {
    const parts = [];
    for (const part of content.parts) {
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

  /**
   * Copied from @google-labs/breadboard
   */
  function isLLMContent(nodeValue) {
    if (typeof nodeValue !== "object" || !nodeValue) return false;
    if (nodeValue === null || nodeValue === undefined) return false;

    return "parts" in nodeValue && Array.isArray(nodeValue.parts);
  }

  function isLLMContentArray(nodeValue) {
    if (!Array.isArray(nodeValue)) return false;
    return isLLMContent(nodeValue.at(-1));
  }
}
