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
  promptToBlocks,
  blocksToPrompt,
  type ParsedPrompt,
  type PromptBlock,
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

type PromptBlock = LLMContent & {
  originalPart?: TemplatePart;
};

/**
 * Converts a serialized template prompt (LLMContent) into an array of LLMContent blocks,
 * where text segments and asset placeholders become distinct blocks.
 * Preserves other placeholders (tools, inputs) via an originalPart property for round-tripping.
 */
function promptToBlocks(promptVal: unknown): LLMContent[] {
  if (!promptVal || typeof promptVal !== "object") return [];
  const content = promptVal as Partial<LLMContent>;
  const parts = content.parts;
  if (!Array.isArray(parts) || parts.length === 0) return [];

  // If it's a single text part, parse legacy JSON placeholders.
  if (parts.length === 1 && "text" in parts[0]) {
    const text = parts[0].text;
    if (!text) return [];

    const blocks: LLMContent[] = [];
    const matches = text.matchAll(PLACEHOLDER_REGEX);
    let start = 0;

    for (const match of matches) {
      const json = match.groups?.json;
      const end = match.index;
      if (end !== undefined && end > start) {
        const textPiece = text.slice(start, end);
        blocks.push({
          role: "user",
          parts: [{ text: textPiece }],
        });
      }
      if (json) {
        try {
          const parsed = JSON.parse(json);
          if (isTemplatePart(parsed)) {
            if (parsed.type === "asset") {
              const block: PromptBlock = {
                role: "user",
                parts: [
                  {
                    storedData: {
                      handle: parsed.path,
                      mimeType: parsed.mimeType || "application/octet-stream",
                    },
                  },
                ],
              };
              block.originalPart = parsed;
              blocks.push(block);
            } else {
              // Preserve other placeholders (like tool/in/param) as originalPart so they roundtrip.
              const block: PromptBlock = {
                role: "user",
                parts: [
                  {
                    text: "",
                  },
                ],
              };
              block.originalPart = parsed;
              blocks.push(block);
            }
          }
        } catch {
          // If JSON parse fails, treat it as plain text.
          const textPiece = text.slice(end!, end! + match[0].length);
          blocks.push({
            role: "user",
            parts: [{ text: textPiece }],
          });
        }
      }
      start = (end ?? 0) + match[0].length;
    }

    if (start < text.length) {
      const textPiece = text.slice(start);
      blocks.push({
        role: "user",
        parts: [{ text: textPiece }],
      });
    }

    return mergeBlocks(blocks);
  }

  // Multi-part content: convert each part to its own block.
  return parts.map((part) => {
    return {
      role: "user",
      parts: [part],
    };
  });
}

/**
 * Merges consecutive text blocks that are not decorated with originalPart.
 */
function mergeBlocks(blocks: LLMContent[]): LLMContent[] {
  const merged: LLMContent[] = [];
  for (const block of blocks) {
    if (!block.parts || block.parts.length === 0) continue;
    const last = merged.at(-1);
    const lastPart = last?.parts?.[0];
    const currentPart = block.parts[0];

    const decoratedBlock = block as { originalPart?: TemplatePart };
    const decoratedLast = last as { originalPart?: TemplatePart } | undefined;

    if (
      last &&
      lastPart &&
      "text" in lastPart &&
      !decoratedLast?.originalPart &&
      "text" in currentPart &&
      !decoratedBlock.originalPart
    ) {
      lastPart.text += currentPart.text;
    } else {
      // Clone the block to prevent modifying the original structure
      const clone: PromptBlock = { ...block };
      if (decoratedBlock.originalPart) {
        clone.originalPart = decoratedBlock.originalPart;
      }
      merged.push(clone);
    }
  }
  return merged;
}

/**
 * Converts an array of LLMContent blocks back into a single LLMContent prompt
 * with serialized JSON placeholders for backward compatibility.
 */
function blocksToPrompt(blocks: LLMContent[]): LLMContent {
  let promptText = "";

  for (const block of blocks) {
    if (!block.parts || block.parts.length === 0) continue;
    const part = block.parts[0];

    const decoratedBlock = block as { originalPart?: TemplatePart };
    if (decoratedBlock.originalPart) {
      promptText += Template.part(decoratedBlock.originalPart);
      continue;
    }

    if ("text" in part) {
      promptText += part.text;
    } else if ("storedData" in part) {
      const path = part.storedData.handle;
      const mimeType = part.storedData.mimeType;
      const title = path.split("/").pop() || "asset";
      promptText += Template.part({
        type: "asset",
        path,
        title,
        mimeType,
      });
    } else if ("fileData" in part) {
      const path = part.fileData.fileUri;
      const mimeType = part.fileData.mimeType;
      const title = path.split("/").pop() || "asset";
      promptText += Template.part({
        type: "asset",
        path,
        title,
        mimeType,
      });
    } else if ("inlineData" in part) {
      const mimeType = part.inlineData.mimeType;
      const title = part.inlineData.title || "asset";
      promptText += Template.part({
        type: "asset",
        path: title,
        title,
        mimeType,
      });
    }
  }

  return {
    role: "user",
    parts: [{ text: promptText }],
  };
}
