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

class Template {
  #renderableValue = "";

  constructor(public readonly raw: string) {
    raw = raw.trim();

    this.#renderableValue = raw;
    if (raw === "") {
      this.#renderableValue = "&nbsp;";
    }
  }

  get preview() {
    return this.raw
      .replaceAll(/{{\s?(.*?)\s?\|\s?"(.*?)"\s?\|\s?"(.*?)"\s?}}/gim, "$3")
      .trim();
  }

  get renderable() {
    return this.#renderableValue;
  }

  substitute(callback: TemplatePartCallback) {
    const value = this.raw;
    const finder = /{{\s?(.*?)\s?\|\s?"(.*?)"\s?\|\s?"(.*?)"\s?}}/gim;
    const matches = [];
    let res;
    do {
      res = finder.exec(value);
      if (res) {
        matches.push(res);
      }
    } while (res);

    if (matches.length === 0) {
      return;
    }

    this.#renderableValue = "";
    let current = 0;
    for (const match of matches) {
      const [str, type, path, title] = match;
      if (current < match.index) {
        this.#renderableValue += value.slice(current, match.index);
      }

      // To keep things a bit simpler in the regexp and so forth we send this
      // out as a single line string.
      this.#renderableValue += callback({ type, path, title });
      current = match.index + str.length;
    }

    if (current < value.length) {
      this.#renderableValue += value.slice(current);
    } else {
      // Ensure that if the final item is a chiclet we add a space on.
      this.#renderableValue += "&nbsp;";
    }
  }

  static preamble({ type, path }: TemplatePart) {
    return `{{ ${type} | "${path}" | "`;
  }

  static postamble() {
    return `" }}`;
  }
}
