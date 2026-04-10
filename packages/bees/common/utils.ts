/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TicketData } from "./types.js";

export { extractPrompt, extractChoices };
export type { Choice };

interface Choice {
  id: string;
  text: string;
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
