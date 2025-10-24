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
import { mergeTextParts, toText } from "../a2/utils";
import { AgentFileSystem } from "./file-system";
import { err, ok } from "@breadboard-ai/utils";

export { PidginTranslator };

export type PidginTextPart = {
  text: string;
};

export type PidginFilePart = {
  file: string;
};

export type PidginLinkPart = {
  link: { href: string; title: string };
};

export type PidginPart = PidginTextPart | PidginFilePart | PidginLinkPart;

const SPLIT_REGEX =
  /(<file\s+src\s*=\s*"[^"]*"\s*\/>|<a\s+href\s*=\s*"[^"]*"\s*>[^<]*<\/a>)/g;

const FILE_PARSE_REGEX = /<file\s+src\s*=\s*"([^"]*)"\s*\/>/;
const LINK_PARSE_REGEX = /<a\s+href\s*=\s*"([^"]*)"\s*>\s*([^<]*)\s*<\/a>/;

/**
 * Translates to and from Agent pidgin: a simplified XML-like
 * language that is tuned to be understood by Gemini.
 */
class PidginTranslator {
  constructor(
    private readonly caps: Capabilities,
    private readonly fileSystem: AgentFileSystem
  ) {}

  fromPidginString(content: string): Outcome<LLMContent> {
    const pidginParts = content.split(SPLIT_REGEX);
    const errors: string[] = [];
    const parts: DataPart[] = pidginParts
      .map((pidginPart) => {
        const fileMatch = pidginPart.match(FILE_PARSE_REGEX);
        if (fileMatch) {
          const path = fileMatch[1];
          const part = this.fileSystem.get(path);
          if (!ok(part)) {
            errors.push(part.$error);
            return null;
          }
          return part;
        }
        const linkMatch = pidginPart.match(LINK_PARSE_REGEX);
        if (linkMatch) {
          return { text: linkMatch[2].trim() };
        }
        return { text: pidginPart };
      })
      .filter((part) => part !== null);

    if (errors.length > 0) {
      return err(`Agent unable to proceed: ${errors.join(",")}`);
    }

    return { parts: mergeTextParts(parts), role: "user" };
  }

  fromPidginFiles(files: string[]): Outcome<LLMContent> {
    const errors: string[] = [];
    const parts: DataPart[] = files
      .map((path) => {
        const part = this.fileSystem.get(path);
        if (!ok(part)) {
          errors.push(part.$error);
          return null;
        }
        return part;
      })
      .filter((part) => part !== null);

    if (errors.length > 0) {
      return err(`Agent unable to proceed: ${errors.join(",")}`);
    }

    return { parts: mergeTextParts(parts), role: "user" };
  }

  async toPidgin(
    content: LLMContent,
    params: Params
  ): Promise<Outcome<string>> {
    const template = new Template(this.caps, content);
    const errors: string[] = [];
    const pidginContent = await template.asyncSimpleSubstitute(
      async (param) => {
        const { type } = param;
        switch (type) {
          case "asset": {
            const content = await template.loadAsset(param);
            if (!ok(content)) {
              errors.push(content.$error);
              return "";
            }
            const part = content?.at(-1)?.parts.at(0);
            if (!part) {
              errors.push(`invalid asset format`);
              return "";
            }
            const name = this.fileSystem.add(part);
            return `<file src="${name}" />`;
          }
          case "in": {
            const value = params[Template.toId(param.path)];
            if (!value) {
              return "";
            } else if (typeof value === "string") {
              return value;
            } else if (isLLMContent(value)) {
              return substituteParts(value, this.fileSystem);
            } else if (isLLMContentArray(value)) {
              const last = value.at(-1);
              if (!last) return "";
              return substituteParts(last, this.fileSystem);
            } else {
              errors.push(
                `Agent: Unknown param value type: "${JSON.stringify(value)}`
              );
            }
            return param.title;
          }
          case "param":
            errors.push(
              `Agent: Params aren't supported in template substitution`
            );
            return "";
          case "tool":
          default:
            return param.title;
        }

        function substituteParts(
          value: LLMContent,
          fileSystem: AgentFileSystem
        ) {
          const values: string[] = [];
          for (const part of value.parts) {
            if ("text" in part) {
              values.push(part.text);
            } else {
              const name = fileSystem.add(part);
              if (!ok(name)) {
                console.warn(name.$error);
                continue;
              }
              values.push(`<file src="${name}" />`);
            }
          }
          return values.join("\n");
        }
      }
    );

    if (errors.length > 0) {
      return err(`Agent: ${errors.join(",")}`);
    }

    return toText(pidginContent);
  }
}
