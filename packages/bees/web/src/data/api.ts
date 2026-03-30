/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybookData } from "./types.js";

export { BeesAPI, type PulseTask };

interface PulseTask {
  id: string;
  title: string;
  context: string;
  current_step: string;
  status: string;
  completed_steps: number;
  total_steps: number;
  created_at: string | null;
}

/**
 * Thin wrapper around the Bees REST endpoints.
 */
class BeesAPI {
  async addTicket(
    objective: string,
    tags?: string[],
    functions?: string[],
    skills?: string[]
  ) {
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

  async respond(
    ticketId: string,
    text?: string,
    selectedIds?: string[],
    contextUpdates?: string[]
  ) {
    await fetch(`/tickets/${ticketId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, selectedIds, contextUpdates }),
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

  async getFile(ticketId: string, path: string): Promise<string | null> {
    try {
      const resp = await fetch(`/tickets/${ticketId}/files/${path}`);
      if (!resp.ok) return null;
      return resp.text();
    } catch (e) {
      console.error(`Error fetching file ${path} for ticket ${ticketId}:`, e);
      return null;
    }
  }

  async getPulse(): Promise<{
    text: string;
    active: boolean;
    tasks: PulseTask[];
  }> {
    try {
      const resp = await fetch("/pulse");
      if (!resp.ok) return { text: "", active: false, tasks: [] };
      return resp.json();
    } catch (e) {
      console.error("Error fetching pulse:", e);
      return { text: "", active: false, tasks: [] };
    }
  }
}
