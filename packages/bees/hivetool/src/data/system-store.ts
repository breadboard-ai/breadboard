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
export type { SystemData };

/** The shape of SYSTEM.yaml. */
interface SystemData {
  title: string;
  description: string;
  root: string;
}

const EMPTY: SystemData = { title: "", description: "", root: "" };

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
      this.config.set({
        title: String(raw.title ?? ""),
        description: String(raw.description ?? ""),
        root: String(raw.root ?? ""),
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

    const body = yaml.dump(data, {
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
