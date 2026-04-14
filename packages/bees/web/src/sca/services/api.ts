/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */



export { BeesAPI };

/**
 * Thin wrapper around the Bees REST endpoints.
 *
 * All endpoints use the `/agents` prefix and semantic verbs.
 */
class BeesAPI {
  async reply(agentId: string, text: string) {
    await fetch(`/agents/${agentId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  async choose(agentId: string, selectedIds: string[]) {
    await fetch(`/agents/${agentId}/choose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedIds }),
    });
  }

  async retry(agentId: string) {
    await fetch(`/agents/${agentId}/retry`, {
      method: "POST",
    });
  }

  async updateTags(agentId: string, tags: string[]): Promise<boolean> {
    try {
      const resp = await fetch(`/agents/${agentId}/tags`, {
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

  async getBundle(
    agentId: string,
    slug?: string | null
  ): Promise<{ js: string; css?: string } | null> {
    try {
      const params = slug ? `?slug=${encodeURIComponent(slug)}` : "";
      const resp = await fetch(`/agents/${agentId}/bundle${params}`);
      if (!resp.ok) return null;
      return resp.json();
    } catch (e) {
      console.error(`Error fetching bundle for agent ${agentId}:`, e);
      return null;
    }
  }

  async getFile(agentId: string, path: string): Promise<string | null> {
    try {
      const resp = await fetch(`/agents/${agentId}/files/${path}`);
      if (!resp.ok) return null;
      return resp.text();
    } catch (e) {
      console.error(`Error fetching file ${path} for agent ${agentId}:`, e);
      return null;
    }
  }

  async listFiles(agentId: string): Promise<string[]> {
    try {
      const resp = await fetch(`/agents/${agentId}/files`);
      if (!resp.ok) return [];
      return resp.json();
    } catch (e) {
      console.error(`Error listing files for agent ${agentId}:`, e);
      return [];
    }
  }

}
