/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for ticket templates.
 *
 * Reads and writes `hive/config/TEMPLATES.yaml` via the shared `StateAccess`
 * handle and exposes the parsed template list as a reactive signal.
 */

import { Signal } from "signal-polyfill";
import yaml from "js-yaml";

import type { StateAccess } from "./state-access.js";

export { TemplateStore };
export type { TemplateData, OptionPropertySchema };

/** Schema for a single option property within a template's options_schema. */
interface OptionPropertySchema {
  type: string;
  description?: string;
  enum?: Array<string | number>;
}

/** A single template entry from TEMPLATES.yaml. */
interface TemplateData {
  name: string;
  title?: string;
  description?: string;
  objective?: string;
  functions?: string[];
  skills?: string[];
  tags?: string[];
  model?: string;
  watch_events?: Array<{ type: string }>;
  tasks?: string[];
  autostart?: string[];
  runner?: "generate" | "live" | "direct_model";
  voice?: string;
  options_schema?: Record<string, OptionPropertySchema>;
  isWorkspaceScoped?: boolean;
  ticketId?: string;
}

class TemplateStore {
  constructor(readonly access: StateAccess) {}

  readonly templates = new Signal.State<TemplateData[]>([]);
  readonly selectedTemplateName = new Signal.State<string | null>(null);
  readonly selectedTemplate = new Signal.Computed(() => {
    const name = this.selectedTemplateName.get();
    if (!name) return null;
    return this.templates.get().find((t) => t.name === name) ?? null;
  });

  #activated = false;

  /** Activate the store — resolve config dir, parse TEMPLATES.yaml. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;
    this.#activated = true;
    await this.scan();
  }

  /** Read and parse TEMPLATES.yaml from the config folder, AND scan any local templates in the active ticket. */
  async scan(activeTicketId?: string | null): Promise<void> {
    const handle = this.access.handle;
    if (!handle) return;

    const allTemplates: TemplateData[] = [];

    // 1. Read and parse legacy TEMPLATES.yaml from config/
    try {
      const configDir = await handle.getDirectoryHandle("config");
      const fileHandle = await configDir.getFileHandle("TEMPLATES.yaml");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = yaml.load(text);

      if (Array.isArray(data)) {
        allTemplates.push(...(data as TemplateData[]));
      }
    } catch (e) {
      console.warn("Could not read config/TEMPLATES.yaml:", e);
    }

    // 2. If an active agent ID is provided, scan agents/{id}/sessions/{session}/workspace/templates/*.yaml
    if (activeTicketId) {
      try {
        const agentsDir = await handle.getDirectoryHandle("agents");
        const agentDir = await agentsDir.getDirectoryHandle(activeTicketId);
        
        let fsDir: FileSystemDirectoryHandle;
        let activeSession: string | null = null;
        try {
          const metaFile = await agentDir.getFileHandle("metadata.json");
          const metaText = await (await metaFile.getFile()).text();
          const meta = JSON.parse(metaText);
          activeSession = meta?.active_session ?? null;
        } catch {
          // Meta might not exist yet — ignore
        }

        if (activeSession) {
          const sessionsDir = await agentDir.getDirectoryHandle("sessions");
          const sessionDir = await sessionsDir.getDirectoryHandle(activeSession);
          fsDir = await sessionDir.getDirectoryHandle("workspace");
        } else {
          fsDir = await agentDir.getDirectoryHandle("filesystem");
        }

        const templatesDir = await fsDir.getDirectoryHandle("templates");
        
        for await (const [name, entry] of (
          templatesDir as FileSystemDirectoryHandle & {
            entries(): AsyncIterable<[string, FileSystemHandle]>;
          }
        ).entries()) {
          if (entry.kind !== "file" || (!name.endsWith(".yaml") && !name.endsWith(".yml"))) {
            continue;
          }
          try {
            const fileHandle = await templatesDir.getFileHandle(name);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const tData = yaml.load(text);
            if (tData && typeof tData === "object") {
              const template = tData as TemplateData;
              if (!template.name) {
                template.name = name.substring(0, name.lastIndexOf("."));
              }
              
              // Inject metadata for visual badge and route rendering
              template.isWorkspaceScoped = true;
              if (activeTicketId) template.ticketId = activeTicketId;

              // Overwrite global templates with workspace definitions if they match names
              const existingIndex = allTemplates.findIndex((t) => t.name === template.name);
              if (existingIndex !== -1) {
                allTemplates[existingIndex] = template;
              } else {
                allTemplates.push(template);
              }
            }
          } catch (e) {
            console.warn(`Could not load local template ${name}:`, e);
          }
        }
      } catch {
        // Quietly catch when filesystem/templates directory does not exist yet
      }
    }

    this.templates.set(allTemplates);
  }

  selectTemplate(name: string): void {
    this.selectedTemplateName.set(name);
  }

  // ── Write operations ──

  /** Save an existing template by replacing its entry and writing to disk. */
  async saveTemplate(originalName: string, data: TemplateData, activeTicketId?: string | null): Promise<void> {
    if (data.isWorkspaceScoped && activeTicketId) {
      await this.#writeLocalTemplate(activeTicketId, data);
    } else {
      const current = this.templates.get();
      const index = current.findIndex((t) => t.name === originalName);
      if (index === -1) throw new Error(`Template "${originalName}" not found`);

      const updated = [...current];
      updated[index] = data;
      const globalsOnly = updated.filter((t) => !t.isWorkspaceScoped);
      await this.#writeTemplates(globalsOnly);
    }
    await this.scan(activeTicketId);
  }

  /** Create a new template by appending it and writing to disk. */
  async createTemplate(data: TemplateData, activeTicketId?: string | null, saveLocal = false): Promise<void> {
    const current = this.templates.get();
    if (current.some((t) => t.name === data.name))
      throw new Error(`Template "${data.name}" already exists`);

    if (saveLocal && activeTicketId) {
      data.isWorkspaceScoped = true;
      data.ticketId = activeTicketId;
      await this.#writeLocalTemplate(activeTicketId, data);
    } else {
      const globalsOnly = current.filter((t) => !t.isWorkspaceScoped);
      const updated = [...globalsOnly, data];
      await this.#writeTemplates(updated);
    }
    await this.scan(activeTicketId);
    this.selectedTemplateName.set(data.name);
  }

  /** Delete a template by name and write to disk. */
  async deleteTemplate(name: string, activeTicketId?: string | null): Promise<void> {
    const current = this.templates.get();
    const target = current.find((t) => t.name === name);
    if (!target) throw new Error(`Template "${name}" not found`);

    if (target.isWorkspaceScoped && activeTicketId) {
      await this.#deleteLocalTemplate(activeTicketId, name);
    } else {
      const globalsOnly = current.filter((t) => t.name !== name && !t.isWorkspaceScoped);
      await this.#writeTemplates(globalsOnly);
    }
    
    await this.scan(activeTicketId);
    if (this.selectedTemplateName.get() === name)
      this.selectedTemplateName.set(null);
  }

  async #writeLocalTemplate(ticketId: string, template: TemplateData): Promise<void> {
    const handle = this.access.handle;
    if (!handle) throw new Error("No hive directory handle");

    const agentsDir = await handle.getDirectoryHandle("agents");
    const agentDir = await agentsDir.getDirectoryHandle(ticketId);
    
    let fsDir: FileSystemDirectoryHandle;
    let activeSession: string | null = null;
    try {
      const metaFile = await agentDir.getFileHandle("metadata.json");
      const metaText = await (await metaFile.getFile()).text();
      const meta = JSON.parse(metaText);
      activeSession = meta?.active_session ?? null;
    } catch {
      // Meta might not exist yet
    }

    if (activeSession) {
      const sessionsDir = await agentDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(activeSession);
      fsDir = await sessionDir.getDirectoryHandle("workspace");
    } else {
      fsDir = await agentDir.getDirectoryHandle("filesystem");
    }

    const templatesDir = await fsDir.getDirectoryHandle("templates", { create: true });
    const fileHandle = await templatesDir.getFileHandle(`${template.name}.yaml`, { create: true });
    const writable = await fileHandle.createWritable();

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      if (key === "isWorkspaceScoped" || key === "ticketId") continue;
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      cleaned[key] = value;
    }

    const content = yaml.dump(cleaned, {
      lineWidth: 80,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    await writable.write(content);
    await writable.close();
  }

  async #deleteLocalTemplate(ticketId: string, name: string): Promise<void> {
    const handle = this.access.handle;
    if (!handle) throw new Error("No hive directory handle");

    const agentsDir = await handle.getDirectoryHandle("agents");
    const agentDir = await agentsDir.getDirectoryHandle(ticketId);
    
    let fsDir: FileSystemDirectoryHandle;
    let activeSession: string | null = null;
    try {
      const metaFile = await agentDir.getFileHandle("metadata.json");
      const metaText = await (await metaFile.getFile()).text();
      const meta = JSON.parse(metaText);
      activeSession = meta?.active_session ?? null;
    } catch {
      // Meta might not exist yet
    }

    if (activeSession) {
      const sessionsDir = await agentDir.getDirectoryHandle("sessions");
      const sessionDir = await sessionsDir.getDirectoryHandle(activeSession);
      fsDir = await sessionDir.getDirectoryHandle("workspace");
    } else {
      fsDir = await agentDir.getDirectoryHandle("filesystem");
    }

    const templatesDir = await fsDir.getDirectoryHandle("templates");
    await templatesDir.removeEntry(`${name}.yaml`);
  }

  /**
   * Serialize template array to YAML and write to TEMPLATES.yaml.
   *
   * Strips undefined/empty fields before serialization so the YAML stays
   * clean (no `functions: []` or `model: null` entries).
   */
  async #writeTemplates(templates: TemplateData[]): Promise<void> {
    const handle = this.access.handle;
    if (!handle) throw new Error("No hive directory handle");

    // Clean each template: remove empty arrays and undefined values.
    const cleaned = templates.map((t) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(t)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (value === "") continue;
        out[key] = value;
      }
      return out;
    });

    const header =
      "# Ticket templates — see docs/patterns.md for the field reference.\n\n";
    const raw = yaml.dump(cleaned, {
      lineWidth: 80,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    // Insert a blank line between top-level entries for readability.
    const body = raw.replace(/\n(- name:)/g, "\n\n$1");
    const content = header + body;

    const configDir = await handle.getDirectoryHandle("config");
    const fileHandle = await configDir.getFileHandle("TEMPLATES.yaml");
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Re-scan to sync signal state.
    await this.scan();
  }

  /** Tear down state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#activated = false;
    this.templates.set([]);
    this.selectedTemplateName.set(null);
  }
}
