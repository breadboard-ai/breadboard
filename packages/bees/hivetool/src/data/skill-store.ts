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
  /** Full markdown body (everything after the frontmatter). */
  body: string;
}

/** Matches YAML frontmatter delimited by --- lines. */
const FRONTMATTER_RE = /\A---\s*\n(.*?)\n---\s*\n/s;

/**
 * Minimal frontmatter parser — extracts key: value pairs from a
 * `---`-delimited YAML block at the start of a markdown file.
 * Avoids pulling in js-yaml for this simple structure.
 */
function parseFrontmatter(text: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: text };

  const yamlBlock = match[1];
  const meta: Record<string, string> = {};
  // Simple line-by-line key: value extraction. Handles multi-line
  // values that are indented continuations.
  let currentKey = "";
  let currentValue = "";
  for (const line of yamlBlock.split("\n")) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      if (currentKey) meta[currentKey] = currentValue.trim();
      currentKey = kvMatch[1];
      currentValue = kvMatch[2];
    } else if (currentKey && /^\s+/.test(line)) {
      // Continuation line.
      currentValue += " " + line.trim();
    }
  }
  if (currentKey) meta[currentKey] = currentValue.trim();

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

          entries.push({
            dirName: name,
            name: meta.name || name,
            title: meta.title,
            description: meta.description,
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
