/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Signal-backed reactive store for skills.
 *
 * Reads `hive/skills/{name}/SKILL.md` files via the shared `StateAccess`
 * handle. Parses YAML frontmatter for metadata and exposes the full
 * markdown body for detail rendering.
 */

import yaml from "js-yaml";
import { Signal } from "signal-polyfill";
import type { StateAccess } from "./state-access.js";

export { SkillStore };
export type { SkillData };

/** Parsed skill metadata + body from a SKILL.md file. */
interface SkillData {
  /** Directory name (used as the key). */
  dirName: string;
  /** Frontmatter `name` field, falling back to dirName. */
  name: string;
  /** Frontmatter `title` field. */
  title?: string;
  /** Frontmatter `description` field. */
  description?: string;
  /** Frontmatter `allowed-tools` list. */
  allowedTools: string[];
  /** Full markdown body (everything after the frontmatter). */
  body: string;
}

/** Matches YAML frontmatter delimited by --- lines. */
const FRONTMATTER_RE = /^---\s*\n(.*?)\n---\s*\n/s;

/** Parse YAML frontmatter from a markdown file using js-yaml. */
function parseFrontmatter(text: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: text };

  const parsed = yaml.load(match[1]);
  const meta =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const body = text.slice(match[0].length);
  return { meta, body };
}

class SkillStore {
  constructor(private access: StateAccess) {}

  readonly skills = new Signal.State<SkillData[]>([]);
  readonly selectedSkillDir = new Signal.State<string | null>(null);
  readonly selectedSkill = new Signal.Computed(() => {
    const dir = this.selectedSkillDir.get();
    if (!dir) return null;
    return this.skills.get().find((s) => s.dirName === dir) ?? null;
  });

  #activated = false;

  /** Activate the store — resolve skills/ subdir and scan. */
  async activate(): Promise<void> {
    if (this.#activated) return;
    if (this.access.accessState.get() !== "ready") return;
    this.#activated = true;
    await this.scan();
  }

  /** Scan the skills/ directory and parse each SKILL.md. */
  async scan(): Promise<void> {
    const handle = this.access.handle;
    if (!handle) return;

    try {
      const skillsDir = await handle.getDirectoryHandle("skills");
      const entries: SkillData[] = [];

      for await (const [name, entry] of (
        skillsDir as FileSystemDirectoryHandle & {
          entries(): AsyncIterable<[string, FileSystemHandle]>;
        }
      ).entries()) {
        if (entry.kind !== "directory") continue;

        try {
          const skillDir = await skillsDir.getDirectoryHandle(name);
          const fileHandle = await skillDir.getFileHandle("SKILL.md");
          const file = await fileHandle.getFile();
          const text = await file.text();
          const { meta, body } = parseFrontmatter(text);

          // Parse allowed-tools: accepts YAML list or space-separated string.
          const rawTools = meta["allowed-tools"];
          let allowedTools: string[] = [];
          if (Array.isArray(rawTools)) {
            allowedTools = rawTools.map(String);
          } else if (typeof rawTools === "string") {
            allowedTools = rawTools.split(/\s+/).filter(Boolean);
          }

          entries.push({
            dirName: name,
            name: String(meta.name || name),
            title: meta.title != null ? String(meta.title) : undefined,
            description:
              meta.description != null ? String(meta.description) : undefined,
            allowedTools,
            body,
          });
        } catch {
          // Skip directories without SKILL.md.
        }
      }

      // Sort alphabetically by name.
      entries.sort((a, b) => a.name.localeCompare(b.name));
      this.skills.set(entries);
    } catch (e) {
      console.warn("Could not read skills/ directory:", e);
      this.skills.set([]);
    }
  }

  selectSkill(dirName: string): void {
    this.selectedSkillDir.set(dirName);
  }

  /** Tear down state so the store can be re-activated against a new hive. */
  reset(): void {
    this.#activated = false;
    this.skills.set([]);
    this.selectedSkillDir.set(null);
  }
}
