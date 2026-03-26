/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybookData } from "./types.js";

export { BeesAPI };

/**
 * Thin wrapper around the Bees REST endpoints.
 */
class BeesAPI {
  async addTicket(objective: string, tags?: string[], functions?: string[], skills?: string[]) {
    await fetch("/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective,
        tags: tags?.length ? tags : undefined,
        functions: functions?.length ? functions : undefined,
        skills: skills?.length ? skills : undefined,
      }),
    });
  }

  async updateTags(ticketId: string, tags: string[]): Promise<boolean> {
    try {
      const resp = await fetch(`/tickets/${ticketId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      return resp.ok;
    } catch (e) {
      console.error("Error saving tags:", e);
      return false;
    }
  }

  async respond(ticketId: string, text?: string, selectedIds?: string[]) {
    await fetch(`/tickets/${ticketId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, selectedIds }),
    });
  }

  async listPlaybooks(): Promise<PlaybookData[]> {
    const resp = await fetch("/playbooks");
    if (!resp.ok) return [];
    return resp.json();
  }

  async runPlaybook(name: string): Promise<boolean> {
    const resp = await fetch(`/playbooks/${name}/run`, { method: "POST" });
    return resp.ok;
  }
}
