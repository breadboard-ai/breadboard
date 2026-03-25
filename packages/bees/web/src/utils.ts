/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TicketData } from "./data/types.js";

export { getRelativeTime, extractPrompt, extractChoices, parseTags };
export type { Choice };

interface Choice {
  id: string;
  text: string;
}

function getRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  const now = new Date();
  const past = new Date(isoString);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  if (diffHr > 0) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffSec > 0) return `${diffSec} second${diffSec > 1 ? "s" : ""} ago`;
  return "just now";
}

function extractPrompt(ticket: TicketData): string {
  const se = ticket.suspend_event;
  if (!se) return "(no prompt)";
  for (const key of ["waitForInput", "waitForChoice"]) {
    const payload = se[key] as Record<string, unknown> | undefined;
    if (!payload) continue;
    const prompt = payload.prompt as Record<string, unknown> | undefined;
    const parts = (prompt?.parts as Array<Record<string, string>>) ?? [];
    const texts = parts.filter((p) => p.text).map((p) => p.text);
    if (texts.length) return texts.join("\n");
  }
  return "(no prompt)";
}

function extractChoices(ticket: TicketData): Choice[] {
  const se = ticket.suspend_event;
  if (!se || !se.waitForChoice) return [];
  const payload = se.waitForChoice as Record<string, unknown>;
  const choices = (payload.choices as Array<Record<string, unknown>>) || [];
  return choices.map((c) => {
    const id = (c.id as string) || "";
    const content = c.content as Record<string, unknown>;
    const parts = (content?.parts as Array<Record<string, string>>) || [];
    const texts = parts.filter((p) => p.text).map((p) => p.text);
    return { id, text: texts.join("\n") || id };
  });
}
function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
