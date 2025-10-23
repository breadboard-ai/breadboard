/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent } from "@breadboard-ai/types";
import { Params } from "../a2/common";
import { isLLMContent, isLLMContentArray } from "@breadboard-ai/data";
import { Template } from "../a2/template";

export { PidginTranslator };

/**
 * Translates to and from Agent pidgin: a simplified XML-like
 * language that tuned to be understood by Gemini.
 */
class PidginTranslator {
  constructor(private readonly caps: Capabilities) {}

  toPidgin(content: LLMContent, params: Params): LLMContent {
    const template = new Template(this.caps, content);
    return template.simpleSubstitute((param) => {
      const { type } = param;
      switch (type) {
        case "asset": {
          return `<file src="${param.path}" />`;
        }
        case "in": {
          const value = params[Template.toId(param.path)];
          if (!value) {
            return "";
          } else if (typeof value === "string") {
            return value;
          } else if (isLLMContent(value)) {
            return substituteParts(value);
          } else if (isLLMContentArray(value)) {
            const last = value.at(-1);
            if (!last) return "";
            return substituteParts(last);
          } else {
            console.warn(`Agent: Unknown param value type`, value);
          }
          return param.title;
        }
        case "param":
          console.warn(
            `Agent: Params aren't supported in template substitution`
          );
          return "";
        case "tool":
        default:
          return param.title;
      }

      function substituteParts(value: LLMContent) {
        const values: string[] = [];
        for (const part of value.parts) {
          if ("text" in part) {
            values.push(part.text);
          } else {
            values.push(`<file src="${JSON.stringify(part)}" />`);
          }
        }
        return values.join("\n");
      }
    });
  }
}
