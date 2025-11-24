/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  DataPart,
  JsonSerializable,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { Params } from "../a2/common";
import { isLLMContent, isLLMContentArray } from "@breadboard-ai/data";
import { Template } from "../a2/template";
import { mergeTextParts } from "../a2/utils";
import { AgentFileSystem } from "./file-system";
import { err, ok } from "@breadboard-ai/utils";
import { SimplifiedToolManager, ToolManager } from "../a2/tool-manager";
import { A2ModuleArgs } from "../runnable-module-factory";
import { v0_8 } from "@breadboard-ai/a2ui";

export { PidginTranslator };

export type ToPidginResult = {
  text: string;
  tools: SimplifiedToolManager;
};

export type PidginTextPart = {
  text: string;
};

export type PidginFilePart = {
  file: string;
};

export type PidginLinkPart = {
  link: { href: string; title: string };
};

type ServerMessage = v0_8.Types.ServerToClientMessage;

export type FromPidginMessagesResult = {
  messages: ServerMessage[];
  remap: Map<string, string>;
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
    private readonly moduleArgs: A2ModuleArgs,
    private readonly fileSystem: AgentFileSystem
  ) {}

  fromPidginString(content: string): Outcome<LLMContent> {
    const pidginParts = content.split(SPLIT_REGEX);
    const errors: string[] = [];
    const parts: DataPart[] = pidginParts
      .flatMap((pidginPart) => {
        const fileMatch = pidginPart.match(FILE_PARSE_REGEX);
        if (fileMatch) {
          const path = fileMatch[1];
          const parts = this.fileSystem.get(path);
          if (!ok(parts)) {
            errors.push(parts.$error);
            return null;
          }
          return parts;
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

    return { parts: mergeTextParts(parts, "\n"), role: "user" };
  }

  fromPidginMessages(messages: ServerMessage[]): FromPidginMessagesResult {
    const remap = new Map<string, string>();
    return {
      messages: messages.map((message) => {
        const { surfaceUpdate, dataModelUpdate } = message;
        if (surfaceUpdate) {
          const translatedSurfaceUpdate: ServerMessage["surfaceUpdate"] = {
            ...surfaceUpdate,
            components: surfaceUpdate.components.map((component) => {
              const translatedComponent = substituteLiterals(
                component,
                this.fileSystem,
                remap
              );
              if (!ok(translatedComponent)) {
                console.warn("Failed to translate component", component);
                return component;
              }
              return translatedComponent;
            }),
          };

          return { surfaceUpdate: translatedSurfaceUpdate };
        } else if (dataModelUpdate) {
          const contents = substituteContents(
            dataModelUpdate.contents,
            this.fileSystem
          );
          if (!ok(contents)) {
            console.warn(
              "Failed to translate dataModelUpdate",
              dataModelUpdate
            );
            return message;
          }
          return { dataModelUpdate: { ...dataModelUpdate, contents } };
        } else {
          return message;
        }
      }),
      remap,
    };
  }

  fromPidginFiles(files: string[]): Outcome<LLMContent> {
    const errors: string[] = [];
    const parts: DataPart[] = files
      .flatMap((path) => {
        const parts = this.fileSystem.get(path);
        if (!ok(parts)) {
          errors.push(parts.$error);
          return null;
        }
        return parts;
      })
      .filter((part) => part !== null);

    if (errors.length > 0) {
      return err(`Agent unable to proceed: ${errors.join(",")}`);
    }

    return { parts: mergeTextParts(parts, "\n"), role: "user" };
  }

  async toPidgin(
    content: LLMContent,
    params: Params
  ): Promise<Outcome<ToPidginResult>> {
    const template = new Template(this.caps, content);
    const toolManager = new ToolManager(this.caps, this.moduleArgs);

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
          case "tool": {
            const addingTool = await toolManager.addTool(
              param.path,
              param.instance
            );
            if (!ok(addingTool)) {
              errors.push(addingTool.$error);
              return "";
            }
            return addingTool;
          }
          default:
            console.warn(`Unknown tyep of param`, param);
            return "";
        }
      }
    );

    if (errors.length > 0) {
      return err(`Agent: ${errors.join(",")}`);
    }

    return {
      text: substituteParts(pidginContent, this.fileSystem),
      tools: toolManager,
    };

    function substituteParts(value: LLMContent, fileSystem: AgentFileSystem) {
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
}

/**
 * This function is borrwed from rendered-consistent-ui with some modifications
 * TODO: Make it more aware of the actual structure of the A2UI message,
 * instead of doing plain recursion. Instead of sending every string to
 * potentially replace as path, only send the url literals.
 */
function substituteLiterals<T>(
  data: T,
  fileSystem: AgentFileSystem,
  remap: Map<string, string>
): Outcome<T> {
  const clonedData = structuredClone(data);
  const recursiveReplace = (currentValue: JsonSerializable): void => {
    if (Array.isArray(currentValue)) {
      currentValue.forEach(recursiveReplace);
      return;
    }

    if (typeof currentValue === "object" && currentValue !== null) {
      for (const key in currentValue) {
        if (Object.prototype.hasOwnProperty.call(currentValue, key)) {
          const value = currentValue[key];
          if (
            (key === "literal" ||
              key === "literalString" ||
              key === "value_string") &&
            typeof value === "string"
          ) {
            const url = fileSystem.getFileUrl(value);
            if (url) {
              remap.set(url, value);
            }
            currentValue[key] = url ?? value;
          } else {
            // Recurse.
            recursiveReplace(value);
          }
        }
      }
    }
  };

  try {
    recursiveReplace(clonedData as JsonSerializable);
  } catch (e) {
    return err((e as Error).message);
  }
  return clonedData;
}

function substituteContents<T>(
  data: T,
  fileSystem: AgentFileSystem
): Outcome<T> {
  const clonedData = structuredClone(data);
  const recursiveReplace = (currentValue: JsonSerializable): void => {
    if (Array.isArray(currentValue)) {
      currentValue.forEach(recursiveReplace);
      return;
    }

    if (typeof currentValue === "object" && currentValue !== null) {
      for (const key in currentValue) {
        if (!Object.prototype.hasOwnProperty.call(currentValue, key)) continue;
        const value = currentValue[key];
        if (typeof value === "string") {
          const url = fileSystem.getFileUrl(value);
          currentValue[key] = url ?? value;
        } else {
          recursiveReplace(value);
        }
      }
    }
  };

  try {
    recursiveReplace(clonedData as JsonSerializable);
  } catch (e) {
    return err((e as Error).message);
  }
  return clonedData;
}
