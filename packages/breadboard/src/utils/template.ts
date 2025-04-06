/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { Template };

export type TemplatePartType = "in" | "asset" | "tool" | "param";

export type TemplatePart = {
  /**
   * The type of the part:
   * - "in" - the incoming autowire
   * - "asset" -- an asset that will be embedded into content
   * - "tool" -- a tool that will be invoked
   */
  type: TemplatePartType;
  /**
   * The "path" value varies depending on the type:
   * - for "in" -- the id of the incoming node for the autowire
   * - for "asset" -- the id of the asset
   * - for "tool" -- the URL of the tool
   */
  path: string;
  /**
   * A friendly title to use for preview or in the chiclet UI.
   */
  title: string;
  /**
   * Marks the part as invalid. Useful when there is a
   * dangling autowire or missing asset
   */
  invalid?: true;
  mimeType?: string;
  /**
   * Connector instance. Used to point a tool that represents the
   * connector tool bundle to a particular instance of a connector.
   */
  instance?: string;
};

export type TemplatePartTransformCallback = (
  part: TemplatePart
) => TemplatePart;

export type TemplatePartCallback = (part: TemplatePart) => string;

export type ParsedTemplate = (string | TemplatePart)[];

const PARSING_REGEX = /{(?<json>{(?:.*?)})}/gim;

function isTemplatePart(o: unknown): o is TemplatePart {
  if (!o || typeof o !== "object") return false;
  return "type" in o && "path" in o && "title" in o;
}

function splitToParts(value: string): ParsedTemplate {
  const parts: ParsedTemplate = [];
  const matches = value.matchAll(PARSING_REGEX);
  let start = 0;

  for (const match of matches) {
    const json = match.groups?.json;
    const end = match.index;
    if (end > start) {
      parts.push(value.slice(start, end));
    }
    if (json) {
      let maybeTemplatePart;
      try {
        maybeTemplatePart = JSON.parse(json);
        if (isTemplatePart(maybeTemplatePart)) {
          parts.push(maybeTemplatePart);
        } else {
          maybeTemplatePart = null;
        }
      } catch (e) {
        // do nothing
      } finally {
        if (!maybeTemplatePart) {
          parts.push(value.slice(end, end + match[0].length));
        }
      }
    }
    start = end + match[0].length;
  }
  if (start < value.length) {
    parts.push(value.slice(start));
  }
  // merge string parts
  const merged: ParsedTemplate = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const last = merged.at(-1);
      if (last && typeof last === "string") {
        merged[merged.length - 1] = last + part;
        continue;
      }
    }
    merged.push(part);
  }
  return merged;
}

class Template {
  #parsed: ParsedTemplate;
  #renderableValue = "";

  constructor(public readonly raw: string) {
    raw = raw.trim();

    this.#parsed = splitToParts(raw);

    this.#renderableValue = raw;
    if (raw === "") {
      this.#renderableValue = "";
    }
  }

  get hasPlaceholders() {
    return this.#parsed.find((part) => typeof part !== "string");
  }

  get placeholders() {
    return this.#parsed.filter((part) => typeof part !== "string");
  }

  get preview() {
    return this.#parsed
      .map((part) => (typeof part === "string" ? part : part.title))
      .join("")
      .trim();
  }

  get renderable() {
    return this.#renderableValue;
  }

  get recombined() {
    return this.#parsed
      .map((part) => {
        if (typeof part === "string") return part;
        return Template.part(part);
      })
      .join("");
  }

  transform(callback: TemplatePartTransformCallback): string {
    for (const [index, part] of this.#parsed.entries()) {
      if (typeof part === "string") continue;
      const transformed = callback(part);
      this.#parsed[index] = transformed;
    }
    return this.recombined;
  }

  substitute(callback: TemplatePartCallback) {
    this.#renderableValue = "";

    let last;
    for (const part of this.#parsed) {
      if (typeof part === "string") {
        this.#renderableValue += part;
      } else {
        this.#renderableValue += callback(part);
      }
      last = part;
    }
    // Ensure that if the final item is a chiclet we add a space on.
    if (typeof last !== "string") {
      this.#renderableValue += String.fromCharCode(65279);
    }
  }

  static part(part: TemplatePart) {
    return `{${JSON.stringify(part)}}`;
  }

  static preamble({ type, path, mimeType, instance }: TemplatePart) {
    const maybeMimeType = mimeType
      ? `"mimeType": ${JSON.stringify(mimeType)}, `
      : "";
    const maybeInstance = instance
      ? `"instance": ${JSON.stringify(instance)},`
      : "";
    return `{{"type": ${JSON.stringify(type)}, "path": ${JSON.stringify(path)}, ${maybeMimeType}${maybeInstance}"title": "`;
  }

  static postamble() {
    return `"}}`;
  }
}
