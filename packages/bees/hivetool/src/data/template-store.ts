/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for ticket templates.
 *
 * Reads `hive/config/TEMPLATES.yaml` via the shared `StateAccess` handle
 * and exposes the parsed template list as a reactive signal.
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
  assignee?: string;
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

  /** Tear down state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#activated = false;
    this.templates.set([]);
    this.selectedTemplateName.set(null);
  }
}
