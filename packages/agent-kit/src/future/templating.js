/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { substitute, describeSpecialist, content, describeContent };

/**
 * Part of the "Specialist" v2 component that does the parameter
 * substitution.
 */
function substitute({ in: context, persona, task, ...inputs }) {
  const params = mergeParams(findParams(persona), findParams(task));

  // Make sure that all params are present in the values and collect
  // them into a single object.
  const values = collectValues(params, inputs);

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
    if (!content) return null;
    return {
      role: content.role || "user",
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

  function collectValues(params, inputs) {
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
    return values;
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
    if (nodeValue.length === 0) return true;
    return isLLMContent(nodeValue.at(-1));
  }
}

/**
 * The describer for the "Specialist" v2 component.
 */
function describeSpecialist({ $inputSchema, $outputSchema, persona, task }) {
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

  return mergeSchemas($inputSchema, $outputSchema, props);

  function mergeSchemas(inputScheme, outputSchema, properties) {
    return {
      inputSchema: {
        ...inputScheme,
        properties: {
          ...inputScheme.properties,
          ...properties,
        },
        required: [...(inputScheme.required || []), ...required],
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

/**
 * The guts of the "Content" component.
 */
function content({ template, context, ...inputs }) {
  const params = mergeParams(findParams(template));
  const values = collectValues(params, inputs);

  return {
    context: prependContext(context, subContent(template, values)),
  };

  function prependContext(context, content) {
    content = isEmptyContent(content) ? [] : [content];
    if (!context) return [...content];
    if (isLLMContentArray(context)) {
      // If the last item in the context has a user rule,
      // merge the new content with it instead of creating a new item.
      const last = context.at(-1);
      if (last && last.role === "user") {
        return [
          ...context.slice(0, -1),
          {
            role: "user",
            parts: [...last.parts, ...(content.at(0)?.parts || [])],
          },
        ];
      }
      return [...context, ...content];
    }
    return [content];
  }

  function isEmptyContent(content) {
    if (!content) return true;
    if (!content.parts?.length) return true;
    if (content.parts.length === 1 && !content.parts[0].text) return true;
    if (content.parts.length === 1 && content.parts[0].text.trim() === "")
      return true;
    return false;
  }

  function subContent(content, values) {
    if (!content) return null;
    return {
      role: content.role || "user",
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

  function unique(params) {
    return Array.from(new Set(params));
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

  function collectValues(params, inputs) {
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
    return values;
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
    if (nodeValue.length === 0) return true;
    return isLLMContent(nodeValue.at(-1));
  }
}

/**
 * The describer for the "Content" component.
 */
function describeContent({ $inputSchema, $outputSchema, template }) {
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

  const required = params.map(toId);

  return mergeSchemas($inputSchema, $outputSchema, props);

  function mergeSchemas(inputScheme, outputSchema, properties) {
    return {
      inputSchema: {
        ...inputScheme,
        properties: {
          ...inputScheme.properties,
          ...properties,
        },
        required: [...(inputScheme.required || []), ...required],
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
