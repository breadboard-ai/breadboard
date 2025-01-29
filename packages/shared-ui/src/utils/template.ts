/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { Template };

export type TemplatePart = {
  type: string;
  path: string;
  title: string;
};

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
      this.#renderableValue = "&nbsp;";
    }
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
      this.#renderableValue += "&nbsp;";
    }
  }

  static preamble({ type, path }: TemplatePart) {
    return `{{"type": ${JSON.stringify(type)}, "path": ${JSON.stringify(path)}, "title": "`;
  }

  static postamble() {
    return `"}}`;
  }
}
