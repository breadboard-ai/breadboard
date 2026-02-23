/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolves template placeholders in an LLMContent objective into
 * structured segments for the wire protocol.
 *
 * This module extracts the template resolution logic from `toPidgin`,
 * producing typed segments (`text`, `asset`, `input`, `tool`) that
 * the server consumes. The server owns all pidgin tag generation.
 *
 * Used exclusively in the remote agent path — local mode still uses
 * `toPidgin` directly.
 */

import type { LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import {
  NOTEBOOKLM_MIMETYPE,
  Template as UtilsTemplate,
} from "@breadboard-ai/utils";
import { Template, type ToolParamPart } from "../a2/template.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
  NOTEBOOKLM_TOOL_PATH,
} from "../a2/tool-manager.js";
import type { A2ModuleArgs } from "../runnable-module-factory.js";
import type { Params } from "../a2/common.js";
import { isLLMContent, isLLMContentArray } from "../../data/common.js";
import { substituteDefaultTool } from "./substitute-default-tool.js";

export { resolveToSegments };
export type { Segment, SegmentResolution };

type TextSegment = { type: "text"; text: string };
type AssetSegment = { type: "asset"; title: string; content: LLMContent };
type InputSegment = { type: "input"; title: string; content: LLMContent };
type ToolSegment = {
  type: "tool";
  path: string;
  title?: string;
  instance?: string;
};

type Segment = TextSegment | AssetSegment | InputSegment | ToolSegment;

type SegmentResolution = {
  segments: Segment[];
  flags: {
    useNotebookLM: boolean;
  };
};

/**
 * Resolve an objective's template placeholders into wire protocol segments.
 *
 * This performs the client-side half of what `toPidgin` does:
 * - `{{in:...}}` → text or input segment
 * - `{{asset:...}}` → asset segment (with raw data parts)
 * - `{{tool:...}}` → tool segment or text (for defaults)
 *
 * Data parts stay as-is (storedData, inlineData, etc.) — the server
 * registers them in its AgentFileSystem and produces pidgin tags.
 */
async function resolveToSegments(
  objective: LLMContent,
  params: Params,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<SegmentResolution>> {
  const template = new Template(objective, moduleArgs.context.currentGraph);

  const errors: string[] = [];
  let useNotebookLM = false;

  const segments = await template.asyncMapParts<Segment | null>({
    onText: (text) => (text ? { type: "text", text } : null),

    onData: (part) => ({
      type: "input",
      title: "attachment",
      content: { parts: [part], role: "user" },
    }),

    onParam: async (param): Promise<Segment | null> => {
      const { type } = param;
      switch (type) {
        case "asset": {
          if (param.mimeType === NOTEBOOKLM_MIMETYPE) {
            useNotebookLM = true;
          }
          const content = await template.loadAsset(param);
          if (!ok(content)) {
            errors.push(content.$error);
            return null;
          }
          const lastContent = content?.at(-1);
          if (!lastContent || lastContent.parts.length === 0) {
            errors.push(`Agent: Invalid asset format`);
            return null;
          }
          return {
            type: "asset",
            title: param.title || "asset",
            content: lastContent,
          };
        }
        case "in": {
          const value = params[Template.toId(param.path)];
          if (!value) {
            return null;
          } else if (typeof value === "string") {
            return { type: "text", text: value };
          } else if (isLLMContent(value)) {
            if (hasNlmAssetInContent(value)) {
              useNotebookLM = true;
            }
            return {
              type: "input",
              title: param.title || "input",
              content: value,
            };
          } else if (isLLMContentArray(value)) {
            const last = value.at(-1);
            if (!last) return null;
            if (hasNlmAssetInContent(last)) {
              useNotebookLM = true;
            }
            return {
              type: "input",
              title: param.title || "input",
              content: last,
            };
          } else {
            errors.push(
              `Agent: Unknown param value type: "${JSON.stringify(value)}`
            );
          }
          return param.title ? { type: "text", text: param.title } : null;
        }
        case "tool": {
          return resolveToolParam(param, useNotebookLM, (v) => {
            useNotebookLM = v;
          });
        }
        default:
          return null;
      }
    },
  });

  if (errors.length > 0) {
    return err(`Agent: ${errors.join(",")}`);
  }

  return {
    segments: segments.filter((s): s is Segment => s !== null),
    flags: { useNotebookLM },
  };
}

function resolveToolParam(
  param: ToolParamPart,
  _useNotebookLM: boolean,
  setUseNotebookLM: (v: boolean) => void
): Segment | null {
  if (param.path === ROUTE_TOOL_PATH) {
    if (!param.instance) {
      return null;
    }
    return {
      type: "tool",
      path: ROUTE_TOOL_PATH,
      title: param.title,
      instance: param.instance,
    };
  } else if (param.path === MEMORY_TOOL_PATH) {
    return { type: "tool", path: MEMORY_TOOL_PATH };
  } else if (param.path === NOTEBOOKLM_TOOL_PATH) {
    setUseNotebookLM(true);
    return { type: "tool", path: NOTEBOOKLM_TOOL_PATH };
  } else {
    // Check for default tool substitution first
    const substitute = substituteDefaultTool(param);
    if (substitute !== null) {
      return { type: "text", text: substitute };
    }
    // Custom tool — server will load and invoke
    return {
      type: "tool",
      path: param.path,
      title: param.title,
    };
  }
}

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
