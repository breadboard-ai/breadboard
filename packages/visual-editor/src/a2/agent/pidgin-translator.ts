/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPart,
  JsonSerializable,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { Params } from "../a2/common.js";
import { Template } from "../a2/template.js";
import { mergeTextParts, tr } from "../a2/utils.js";
import { AgentFileSystem } from "./file-system.js";
import { err, ok } from "@breadboard-ai/utils";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
  NOTEBOOKLM_TOOL_PATH,
  SimplifiedToolManager,
  ToolManager,
} from "../a2/tool-manager.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { v0_8 } from "../../a2ui/index.js";
import { isLLMContent, isLLMContentArray } from "../../data/common.js";
import {
  Template as UtilsTemplate,
  NOTEBOOKLM_MIMETYPE,
  isNotebookLmUrl,
} from "@breadboard-ai/utils";
import { substituteDefaultTool } from "./substitute-default-tool.js";

export { PidginTranslator, MAX_INLINE_CHARACTER_LENGTH };

export type ToPidginResult = {
  text: string;
  tools: SimplifiedToolManager;
  useMemory: boolean;
  useNotebookLM: boolean;
};

export type SubstitutePartsArgs = {
  title: string | undefined;
  content: LLMContent;
  textAsFiles: boolean;
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
 * Checks if LLMContent contains NotebookLM assets by parsing text parts
 * via Template placeholders.
 */
function hasNlmAssetInContent(content: LLMContent): boolean {
  for (const part of content.parts) {
    if ("text" in part) {
      const template = new UtilsTemplate(part.text);
      for (const placeholder of template.placeholders) {
        if (
          placeholder.type === "asset" &&
          placeholder.mimeType === NOTEBOOKLM_MIMETYPE
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * When the text is below this number, it will be simply inlined (small prompts, short outputs, etc.)
 * When the text is above this number, it will be inlined _and_ prefaced with
 * a file reference.
 */
const MAX_INLINE_CHARACTER_LENGTH = 1000;

/**
 * Translates to and from Agent pidgin: a simplified XML-like
 * language that is tuned to be understood by Gemini.
 */
class PidginTranslator {
  constructor(
    private readonly moduleArgs: A2ModuleArgs,
    private readonly fileSystem: AgentFileSystem
  ) {}

  /**
   * Converts LLMContent into a pidgin string. Text parts below
   * MAX_INLINE_CHARACTER_LENGTH are inlined as-is; text parts above the
   * threshold are stored as files and wrapped in `<content>` tags (both
   * inline text AND file handle). Binary parts become `<file>` tags.
   */
  contentToPidginString(content: LLMContent, textAsFiles = true): string {
    const values: string[] = [];
    for (const part of content.parts) {
      if ("text" in part) {
        const { text } = part;
        if (textAsFiles && text.length > MAX_INLINE_CHARACTER_LENGTH) {
          const name = this.fileSystem.add(part);
          if (ok(name)) {
            values.push(`<content src="${name}">\n${text}</content>`);
            continue;
          } else {
            console.warn(name.$error);
          }
        }
        values.push(text);
      } else if (
        "storedData" in part &&
        isNotebookLmUrl(part.storedData.handle)
      ) {
        values.push(part.storedData.handle);
      } else {
        const name = this.fileSystem.add(part);
        if (!ok(name)) {
          console.warn(name.$error);
          continue;
        }
        values.push(`<file src="${name}" />`);
      }
    }
    return values.join("\n");
  }

  async fromPidginString(content: string): Promise<Outcome<LLMContent>> {
    const pidginParts = content.split(SPLIT_REGEX);
    const errors: string[] = [];
    const parts: DataPart[] = (
      await Promise.all(
        pidginParts.map(async (pidginPart) => {
          const fileMatch = pidginPart.match(FILE_PARSE_REGEX);
          if (fileMatch) {
            const path = fileMatch[1];
            const parts = await this.fileSystem.get(path);
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
      )
    )
      .flat()
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

  async fromPidginFiles(files: string[]): Promise<Outcome<LLMContent>> {
    const errors: string[] = [];
    const parts: DataPart[] = (
      await Promise.all(files.map((path) => this.fileSystem.get(path)))
    )
      .flatMap((parts) => {
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
    params: Params,
    textAsFiles: boolean
  ): Promise<Outcome<ToPidginResult>> {
    const template = new Template(
      content,
      this.moduleArgs.context.currentGraph
    );
    const toolManager = new ToolManager(this.moduleArgs);

    const errors: string[] = [];
    let useMemory = false;
    let useNotebookLM = false;

    const substituteParts = ({
      title,
      content: value,
      textAsFiles: asFiles,
    }: SubstitutePartsArgs): string => {
      const text = this.contentToPidginString(value, asFiles);
      if (!title) return text;

      return tr`
<input source-agent="${title}">
${text}
</input>
`;
    };

    const pidginContent = await template.asyncSimpleSubstitute(
      async (param) => {
        const { type } = param;
        switch (type) {
          case "asset": {
            // Check if this asset is a NotebookLM reference
            if (param.mimeType === NOTEBOOKLM_MIMETYPE) {
              useNotebookLM = true;
            }
            const content = await template.loadAsset(param);
            if (!ok(content)) {
              errors.push(content.$error);
              return "";
            }
            const lastContent = content?.at(-1);
            if (!lastContent || lastContent.parts.length === 0) {
              errors.push(`Agent: Invalid asset format`);
              return "";
            }
            const inner = substituteParts({
              title: undefined,
              content: lastContent,
              textAsFiles,
            });
            const title = param.title || "asset";
            return tr`<asset title="${title}">
${inner}
</asset>`;
          }
          case "in": {
            const value = params[Template.toId(param.path)];
            if (!value) {
              return "";
            } else if (typeof value === "string") {
              return value;
            } else if (isLLMContent(value)) {
              // Check if input text contains NotebookLM assets via template placeholders
              if (hasNlmAssetInContent(value)) {
                useNotebookLM = true;
              }
              return substituteParts({
                title: param.title,
                content: value,
                textAsFiles: true,
              });
            } else if (isLLMContentArray(value)) {
              const last = value.at(-1);
              if (!last) return "";
              // Check if input text contains NotebookLM assets via template placeholders
              if (hasNlmAssetInContent(last)) {
                useNotebookLM = true;
              }
              return substituteParts({
                title: param.title,
                content: last,
                textAsFiles: true,
              });
            } else {
              errors.push(
                `Agent: Unknown param value type: "${JSON.stringify(value)}`
              );
            }
            return param.title;
          }
          case "tool": {
            if (param.path === ROUTE_TOOL_PATH) {
              if (!param.instance) {
                errors.push(`Agent: Malformed route, missing instance param`);
                return "";
              }
              const routeName = this.fileSystem.addRoute(param.instance);
              return `<a href="${routeName}">${param.title}</a>`;
            } else if (param.path === MEMORY_TOOL_PATH) {
              useMemory = true;
              return "Use Memory";
            } else if (param.path === NOTEBOOKLM_TOOL_PATH) {
              useNotebookLM = true;
              return "Use NotebookLM";
            } else {
              const substitute = substituteDefaultTool(param);
              if (substitute !== null) {
                return substitute;
              }
              const addingTool = await toolManager.addTool(param);
              if (!ok(addingTool)) {
                errors.push(addingTool.$error);
                return "";
              }
              return addingTool;
            }
          }
          default:
            console.warn(`Unknown type of param`, param);
            return "";
        }
      }
    );

    if (errors.length > 0) {
      return err(`Agent: ${errors.join(",")}`);
    }

    const text =
      pidginContent.parts.length === 1 && "text" in pidginContent.parts[0]
        ? pidginContent.parts[0].text
        : undefined;
    if (text === undefined) {
      console.warn(
        `Agent: Substitution failed, expected single text part, got`,
        pidginContent
      );
      return {
        text: substituteParts({
          title: undefined,
          content: pidginContent,
          textAsFiles,
        }),
        tools: toolManager,
        useMemory,
        useNotebookLM,
      };
    }

    return { text, tools: toolManager, useMemory, useNotebookLM };
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
