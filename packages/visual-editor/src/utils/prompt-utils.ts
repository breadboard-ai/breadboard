/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Pure utility functions for parsing and rebuilding agent prompt strings.
 *
 * The underlying data model stores tool references as `{{...}}` JSON
 * placeholders inline in the prompt text (for backwards compatibility).
 * These utilities let the UI treat objective text and tool references as
 * independent concerns while the storage format remains unchanged.
 */

export {
  parsePrompt,
  buildPrompt,
  extractPromptText,
  extractInPorts,
  type ParsedPrompt,
};

import {
  Template,
  isTemplatePart,
  type TemplatePart,
} from "@breadboard-ai/utils";
import type { InPort } from "../ui/transforms/autowire-in-ports.js";
import type { LLMContent } from "@breadboard-ai/types";

/**
 * The result of parsing a raw prompt string into its constituent parts.
 */
interface ParsedPrompt {
  /** The objective text with all tool placeholders stripped. */
  objectiveText: string;
  /** The tool placeholder parts that were embedded in the prompt. */
  tools: TemplatePart[];
}

/** Matches `{{...}}` placeholder syntax — same regex Template uses internally. */
const PLACEHOLDER_REGEX = /{(?<json>{(?:.*?)})}/gim;

/**
 * Splits a raw prompt string into objective text and tool references.
 *
 * Tool placeholders (`type: "tool"`) are stripped from the text and returned
 * separately. All other placeholder types (`in`, `asset`, `param`) are
 * preserved in the objective text so the text editor can render their chiclets.
 *
 * Handles legacy prompts where tools may appear anywhere in the text — they're
 * always stripped regardless of position.
 */
function parsePrompt(raw: string): ParsedPrompt {
  const tools: TemplatePart[] = [];

  // Replace each tool-type placeholder with empty string, collect the parts
  const stripped = raw.replace(PLACEHOLDER_REGEX, (match, json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (isTemplatePart(parsed) && parsed.type === "tool") {
        tools.push(parsed);
        return "";
      }
    } catch {
      // Not valid JSON — keep the original text
    }
    return match;
  });

  // Clean up whitespace artefacts left by stripping (e.g. blank lines)
  const objectiveText = stripped.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

  return { objectiveText, tools };
}

/**
 * Rebuilds a raw prompt string from objective text and tool references.
 *
 * Tools are always appended at the end of the prompt, one per line,
 * normalising any legacy formats where they may have been interspersed.
 */
function buildPrompt(objectiveText: string, tools: TemplatePart[]): string {
  if (tools.length === 0) return objectiveText;

  const toolStrings = tools.map((t) => Template.part(t));
  if (objectiveText.trim() === "") return toolStrings.join("\n");

  return `${objectiveText.trimEnd()}\n${toolStrings.join("\n")}`;
}

/**
 * Extracts the raw text from a `config$prompt` LLMContent value.
 *
 * This replaces the duplicated `getPromptText` helpers that existed in
 * both `objective-editor.ts` and `tool-shelf.ts`.
 */
function extractPromptText(promptVal: unknown): string {
  if (!promptVal || typeof promptVal !== "object") return "";
  const content = promptVal as Partial<LLMContent>;
  const parts = content.parts;
  if (!Array.isArray(parts) || parts.length === 0) return "";
  const firstPart = parts[0];
  if (!firstPart || typeof firstPart !== "object") return "";
  if ("text" in firstPart) {
    return (firstPart as { text?: string }).text ?? "";
  }
  return "";
}

/**
 * Extracts InPort references from a prompt string for autowiring.
 *
 * Only `type: "in"` placeholders produce InPort entries. Tool and asset
 * placeholders are ignored.
 */
function extractInPorts(promptText: string): InPort[] {
  const template = new Template(promptText);
  const ins: InPort[] = [];
  for (const part of template.placeholders) {
    if (part.type === "in") {
      ins.push({ path: part.path, title: part.title });
    }
  }
  return ins;
}
