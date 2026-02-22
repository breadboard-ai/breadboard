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

  const segments: Segment[] = [];
  const errors: string[] = [];
  let useNotebookLM = false;

  const resolved = await template.asyncSimpleSubstitute(async (param) => {
    const { type } = param;
    switch (type) {
      case "asset": {
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
        // Emit a placeholder marker that we'll replace below.
        // The actual segment gets pushed to the array.
        segments.push({
          type: "asset",
          title: param.title || "asset",
          content: lastContent,
        });
        return ""; // Placeholder — segments carry the data
      }
      case "in": {
        const value = params[Template.toId(param.path)];
        if (!value) {
          return "";
        } else if (typeof value === "string") {
          return value; // Inline as text
        } else if (isLLMContent(value)) {
          if (hasNlmAssetInContent(value)) {
            useNotebookLM = true;
          }
          segments.push({
            type: "input",
            title: param.title || "input",
            content: value,
          });
          return "";
        } else if (isLLMContentArray(value)) {
          const last = value.at(-1);
          if (!last) return "";
          if (hasNlmAssetInContent(last)) {
            useNotebookLM = true;
          }
          segments.push({
            type: "input",
            title: param.title || "input",
            content: last,
          });
          return "";
        } else {
          errors.push(
            `Agent: Unknown param value type: "${JSON.stringify(value)}`
          );
        }
        return param.title || "";
      }
      case "tool": {
        return resolveToolParam(param, segments, useNotebookLM, (v) => {
          useNotebookLM = v;
        });
      }
      default:
        return "";
    }
  });

  if (errors.length > 0) {
    return err(`Agent: ${errors.join(",")}`);
  }

  // The resolved content may have remaining text parts from template
  // substitution. Walk them and add as text segments.
  for (const part of resolved.parts) {
    if ("text" in part && part.text) {
      segments.push({ type: "text", text: part.text });
    } else if (!("text" in part)) {
      // Non-text parts that weren't captured as asset/input content
      // need to travel as part of the top-level objective.
      // Wrap them in a content segment.
      segments.push({
        type: "input",
        title: "attachment",
        content: { parts: [part], role: "user" },
      });
    }
  }

  return {
    segments,
    flags: { useNotebookLM },
  };
}

function resolveToolParam(
  param: ToolParamPart,
  segments: Segment[],
  _useNotebookLM: boolean,
  setUseNotebookLM: (v: boolean) => void
): string {
  if (param.path === ROUTE_TOOL_PATH) {
    if (!param.instance) {
      return "";
    }
    segments.push({
      type: "tool",
      path: ROUTE_TOOL_PATH,
      title: param.title,
      instance: param.instance,
    });
    return "";
  } else if (param.path === MEMORY_TOOL_PATH) {
    segments.push({ type: "tool", path: MEMORY_TOOL_PATH });
    return "";
  } else if (param.path === NOTEBOOKLM_TOOL_PATH) {
    setUseNotebookLM(true);
    segments.push({ type: "tool", path: NOTEBOOKLM_TOOL_PATH });
    return "";
  } else {
    // Check for default tool substitution first
    const substitute = substituteDefaultTool(param);
    if (substitute !== null) {
      return substitute; // text inline
    }
    // Custom tool — server will load and invoke
    segments.push({
      type: "tool",
      path: param.path,
      title: param.title,
    });
    return "";
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
