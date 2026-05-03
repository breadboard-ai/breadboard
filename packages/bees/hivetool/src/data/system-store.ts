/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for hive system configuration.
 *
 * Reads and writes `hive/config/SYSTEM.yaml` via the shared `StateAccess`
 * handle and exposes the parsed config as a reactive signal.
 */

import { Signal } from "signal-polyfill";
import yaml from "js-yaml";

import type { StateAccess } from "./state-access.js";

export { SystemStore };
export type { SystemData, MCPServerConfig, OAuthConfig };

/** OAuth 2.0 configuration for an MCP server. */
interface OAuthConfig {
  /** ${ENV_VAR} reference to the OAuth client ID. */
  client_id: string;
  /** ${ENV_VAR} reference to the OAuth client secret. */
  client_secret: string;
  /** OAuth scopes to request during consent. */
  scopes: string[];
}

/** A single MCP server registration in SYSTEM.yaml. */
interface MCPServerConfig {
  name: string;
  description?: string;
  /** Shell command for stdio transport. */
  command?: string;
  /** URL for Streamable HTTP transport. */
  url?: string;
  /** HTTP headers (values may contain ${ENV_VAR} references). */
  headers?: Record<string, string>;
  /** Environment variables for stdio (values may contain ${ENV_VAR}). */
  env?: Record<string, string>;
  /** OAuth 2.0 configuration. Mutually exclusive with headers. */
  oauth?: OAuthConfig;
}

/** The shape of SYSTEM.yaml. */
interface SystemData {
  title: string;
  description: string;
  root: string;
  mcp: MCPServerConfig[];
}

const EMPTY: SystemData = { title: "", description: "", root: "", mcp: [] };

class SystemStore {
  constructor(private access: StateAccess) {}

  readonly config = new Signal.State<SystemData>(EMPTY);

  #activated = false;

  /** Activate the store — resolve config dir, parse SYSTEM.yaml. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;
    this.#activated = true;
    await this.scan();
  }

  /** Read and parse SYSTEM.yaml from the hive handle. */
  async scan(): Promise<void> {
    const handle = this.access.handle;
    if (!handle) return;

    try {
      const configDir = await handle.getDirectoryHandle("config");
      const fileHandle = await configDir.getFileHandle("SYSTEM.yaml");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = yaml.load(text);

      if (!data || typeof data !== "object") {
        console.warn("SYSTEM.yaml must be a mapping; got", typeof data);
        this.config.set(EMPTY);
        return;
      }

      const raw = data as Record<string, unknown>;
      const rawMcp = Array.isArray(raw.mcp) ? raw.mcp : [];

      this.config.set({
        title: String(raw.title ?? ""),
        description: String(raw.description ?? ""),
        root: String(raw.root ?? ""),
        mcp: rawMcp.map((entry: Record<string, unknown>) => ({
          name: String(entry.name ?? ""),
          description: entry.description ? String(entry.description) : undefined,
          command: entry.command ? String(entry.command) : undefined,
          url: entry.url ? String(entry.url) : undefined,
          headers: entry.headers && typeof entry.headers === "object"
            ? Object.fromEntries(
                Object.entries(entry.headers as Record<string, unknown>).map(
                  ([k, v]) => [k, String(v)]
                )
              )
            : undefined,
          env: entry.env && typeof entry.env === "object"
            ? Object.fromEntries(
                Object.entries(entry.env as Record<string, unknown>).map(
                  ([k, v]) => [k, String(v)]
                )
              )
            : undefined,
          oauth: entry.oauth && typeof entry.oauth === "object"
            ? {
                client_id: String(
                  (entry.oauth as Record<string, unknown>).client_id ?? ""
                ),
                client_secret: String(
                  (entry.oauth as Record<string, unknown>).client_secret ?? ""
                ),
                scopes: Array.isArray(
                  (entry.oauth as Record<string, unknown>).scopes
                )
                  ? ((entry.oauth as Record<string, unknown>).scopes as unknown[]).map(
                      (s) => String(s)
                    )
                  : [],
              }
            : undefined,
        })),
      });
    } catch (e) {
      console.warn("Could not read SYSTEM.yaml:", e);
      this.config.set(EMPTY);
    }
  }

  // ── Write operations ──

  /** Save the system config to disk. */
  async save(data: SystemData): Promise<void> {
    const handle = this.access.handle;
    if (!handle) throw new Error("No hive directory handle");

    const header = [
      "# Hive system configuration.",
      "#",
      "# title       — Display name for this hive instance.",
      "# description — Short summary shown in UI.",
      "# root        — Template name to auto-boot at startup. The system creates a",
      "#               ticket from this template if none with a matching playbook_id",
      "#               exists yet.",
      "",
    ].join("\n");

    // Build the serializable object, omitting empty mcp array.
    const obj: Record<string, unknown> = {
      title: data.title,
      description: data.description,
      root: data.root,
    };

    if (data.mcp.length > 0) {
      obj.mcp = data.mcp.map((server) => {
        const entry: Record<string, unknown> = { name: server.name };
        if (server.description) entry.description = server.description;
        if (server.command) entry.command = server.command;
        if (server.url) entry.url = server.url;
        if (server.headers && Object.keys(server.headers).length > 0) {
          entry.headers = server.headers;
        }
        if (server.env && Object.keys(server.env).length > 0) {
          entry.env = server.env;
        }
        if (server.oauth) {
          entry.oauth = {
            client_id: server.oauth.client_id,
            client_secret: server.oauth.client_secret,
            scopes: server.oauth.scopes,
          };
        }
        return entry;
      });
    }

    const body = yaml.dump(obj, {
      lineWidth: 80,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    const content = header + body;

    const configDir = await handle.getDirectoryHandle("config");
    const fileHandle = await configDir.getFileHandle("SYSTEM.yaml");
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Re-scan to sync signal state.
    await this.scan();
  }

  /** Tear down state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#activated = false;
    this.config.set(EMPTY);
  }
}
