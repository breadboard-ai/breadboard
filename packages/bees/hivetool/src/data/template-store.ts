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
export type { TemplateData };

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
}

class TemplateStore {
  constructor(private access: StateAccess) {}

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

  /** Read and parse TEMPLATES.yaml from the hive handle. */
  async scan(): Promise<void> {
    const handle = this.access.handle;
    if (!handle) return;

    try {
      const configDir = await handle.getDirectoryHandle("config");
      const fileHandle = await configDir.getFileHandle("TEMPLATES.yaml");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = yaml.load(text);

      if (!Array.isArray(data)) {
        console.warn("TEMPLATES.yaml must be a list; got", typeof data);
        this.templates.set([]);
        return;
      }

      this.templates.set(data as TemplateData[]);
    } catch (e) {
      console.warn("Could not read TEMPLATES.yaml:", e);
      this.templates.set([]);
    }
  }

  selectTemplate(name: string): void {
    this.selectedTemplateName.set(name);
  }

  // ── Write operations ──

  /** Save an existing template by replacing its entry and writing to disk. */
  async saveTemplate(
    originalName: string,
    data: TemplateData
  ): Promise<void> {
    const current = this.templates.get();
    const index = current.findIndex((t) => t.name === originalName);
    if (index === -1)
      throw new Error(`Template "${originalName}" not found`);

    const updated = [...current];
    updated[index] = data;
    await this.#writeTemplates(updated);
  }

  /** Create a new template by appending it and writing to disk. */
  async createTemplate(data: TemplateData): Promise<void> {
    const current = this.templates.get();
    if (current.some((t) => t.name === data.name))
      throw new Error(`Template "${data.name}" already exists`);

    const updated = [...current, data];
    await this.#writeTemplates(updated);
    this.selectedTemplateName.set(data.name);
  }

  /** Delete a template by name and write to disk. */
  async deleteTemplate(name: string): Promise<void> {
    const current = this.templates.get();
    const updated = current.filter((t) => t.name !== name);
    if (updated.length === current.length)
      throw new Error(`Template "${name}" not found`);

    await this.#writeTemplates(updated);
    if (this.selectedTemplateName.get() === name)
      this.selectedTemplateName.set(null);
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
      "# Ticket templates — see docs/TEMPLATE_SCHEMA.md for the field reference.\n\n";
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
