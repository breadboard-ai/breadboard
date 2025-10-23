/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  DataPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { Params } from "../a2/common";
import { isLLMContent, isLLMContentArray } from "@breadboard-ai/data";
import { Template } from "../a2/template";
import { llm, toText } from "../a2/utils";
import { AgentFileSystem } from "./file-system";
import { err } from "@breadboard-ai/utils";

export { PidginTranslator };

/**
 * Translates to and from Agent pidgin: a simplified XML-like
 * language that tuned to be understood by Gemini.
 */
class PidginTranslator {
  constructor(private readonly caps: Capabilities) {}

  fromPidginString(content: string): Outcome<LLMContent> {
    return llm`${content}`.asContent();
  }

  fromPidginFiles(
    files: string[],
    fileSystem: AgentFileSystem
  ): Outcome<LLMContent> {
    const errors: string[] = [];
    const parts: DataPart[] = files
      .map((path) => {
        const file = fileSystem.files.get(path);
        if (!file) {
          errors.push(`file "${path}" not found`);
          return null;
        }
        if (file.mimeType === "text/markdown") {
          return {
            text: file.data,
          };
        } else {
          errors.push(`unknown type "${file.mimeType} for file "${path}"`);
          return null;
        }
      })
      .filter((part) => part !== null);

    if (errors.length > 0) {
      return err(`Agent unable to proceed: ${errors.join(",")}`);
    }

    return { parts, role: "user" };
  }

  toPidgin(content: LLMContent, params: Params): string {
    const template = new Template(this.caps, content);
    const pidginContent = template.simpleSubstitute((param) => {
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
    return toText(pidginContent);
  }
}
