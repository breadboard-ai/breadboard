/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities, DataPart, LLMContent } from "@breadboard-ai/types";
import { Template, type ParamPart } from "../../a2/template.js";
import { A2_TOOL_MAP } from "../../a2-registry.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
  NOTEBOOKLM_TOOL_PATH,
} from "../../a2/tool-manager.js";
import { mergeTextParts } from "../../a2/utils.js";

export { EditingAgentPidginTranslator };

export type ToPidginResult = {
  text: string;
};

const SPLIT_REGEX =
  /(<parent\s+src\s*=\s*"[^"]*"\s*\/>|<file\s+src\s*=\s*"[^"]*"\s*\/>|<tool\s+name\s*=\s*"[^"]*"\s*\/>|<a\s+href\s*=\s*"[^"]*"\s*>[^<]*<\/a>)/g;

const PARENT_PARSE_REGEX = /<parent\s+src\s*=\s*"([^"]*)"\s*\/>/;
const FILE_PARSE_REGEX = /<file\s+src\s*=\s*"([^"]*)"\s*\/>/;
const TOOL_PARSE_REGEX = /<tool\s+name\s*=\s*"([^"]*)"\s*\/>/;
const LINK_PARSE_REGEX = /<a\s+href\s*=\s*"([^"]*)"\s*>\s*([^<]*)\s*<\/a>/;

/**
 * Translates to and from a graph-editing variant of Agent pidgin.
 *
 * This pidgin format conveys graph topology — edges (parents),
 * file assets, and tool dependencies — rather than runtime data.
 *
 * Mapping:
 * - `in` params  → `<parent src="node-N" />`
 * - `asset` params → `<file src="path" />`
 * - `tool` params  → `<tool name="friendly-name" />` (or `<a href>` for routes)
 * - `param` params → ignored
 */
class EditingAgentPidginTranslator {
  /** node path → handle (e.g. "node-1") */
  #parentHandles = new Map<string, string>();
  /** handle → node path (reverse) */
  #parentReverse = new Map<string, string>();
  #parentCounter = 0;

  /** tool path → friendly name */
  #toolHandles = new Map<string, string>();
  /** friendly name → tool path (reverse) */
  #toolReverse = new Map<string, string>();
  #toolCounter = 0;

  /** route handle → original instance id */
  #routeHandles = new Map<string, string>();
  #routeCounter = 0;

  constructor(private readonly caps: Capabilities) {}

  toPidgin(content: LLMContent): ToPidginResult {
    const template = new Template(this.caps, content);

    const result = template.simpleSubstitute((param) => {
      const { type } = param;
      switch (type) {
        case "in": {
          const handle = this.#getOrCreateParentHandle(param.path);
          return `<parent src="${handle}" />`;
        }
        case "asset": {
          return `<file src="${param.path}" />`;
        }
        case "tool": {
          return this.#translateTool(param);
        }
        case "param":
          return "";
        default:
          return "";
      }
    });

    const text =
      result.parts.length === 1 && "text" in result.parts[0]
        ? result.parts[0].text
        : "";

    return { text };
  }

  fromPidgin(content: string): LLMContent {
    const segments = content.split(SPLIT_REGEX);
    const parts: DataPart[] = segments
      .map((segment): DataPart | null => {
        if (PARENT_PARSE_REGEX.test(segment)) {
          return { text: segment };
        }
        if (FILE_PARSE_REGEX.test(segment)) {
          return { text: segment };
        }
        if (TOOL_PARSE_REGEX.test(segment)) {
          return { text: segment };
        }
        if (LINK_PARSE_REGEX.test(segment)) {
          return { text: segment };
        }
        if (segment === "") return null;
        return { text: segment };
      })
      .filter((part): part is DataPart => part !== null);

    return { parts: mergeTextParts(parts, ""), role: "user" };
  }

  /**
   * Resolve a parent handle back to the original node path.
   */
  getNodeId(handle: string): string | undefined {
    return this.#parentReverse.get(handle);
  }

  /**
   * Resolve a tool friendly name back to the original tool path.
   */
  getToolPath(name: string): string | undefined {
    return this.#toolReverse.get(name);
  }

  /**
   * Resolve a route handle back to the original route instance.
   */
  getOriginalRoute(handle: string): string | undefined {
    return this.#routeHandles.get(handle);
  }

  // ---- Private helpers ----

  #getOrCreateParentHandle(nodePath: string): string {
    const existing = this.#parentHandles.get(nodePath);
    if (existing) return existing;
    this.#parentCounter++;
    const handle = `node-${this.#parentCounter}`;
    this.#parentHandles.set(nodePath, handle);
    this.#parentReverse.set(handle, nodePath);
    return handle;
  }

  #getOrCreateToolHandle(toolPath: string, friendlyName?: string): string {
    const existing = this.#toolHandles.get(toolPath);
    if (existing) return existing;

    let name: string;
    if (friendlyName) {
      name = this.#toKebabCase(friendlyName);
    } else {
      this.#toolCounter++;
      name = `tool-${this.#toolCounter}`;
    }
    this.#toolHandles.set(toolPath, name);
    this.#toolReverse.set(name, toolPath);
    return name;
  }

  #translateTool(param: ParamPart & { type: "tool" }): string {
    const { path, title, instance } = param as {
      type: "tool";
      path: string;
      title: string;
      instance?: string;
    };

    // Routes use <a href> format, same as original pidgin
    if (path === ROUTE_TOOL_PATH) {
      if (!instance) return "";
      const routeHandle = this.#addRoute(instance);
      return `<a href="${routeHandle}">${title}</a>`;
    }

    // Memory and NLM get fixed descriptive names
    if (path === MEMORY_TOOL_PATH) {
      return `<tool name="memory" />`;
    }
    if (path === NOTEBOOKLM_TOOL_PATH) {
      return `<tool name="notebooklm" />`;
    }

    // Known tools from the A2 registry get friendly names
    const a2Tool = A2_TOOL_MAP.get(path);
    if (a2Tool) {
      const handle = this.#getOrCreateToolHandle(path, a2Tool.title);
      return `<tool name="${handle}" />`;
    }

    // Unknown / custom tools get numbered handles
    const handle = this.#getOrCreateToolHandle(path);
    return `<tool name="${handle}" />`;
  }

  #addRoute(instance: string): string {
    this.#routeCounter++;
    const handle = `/route-${this.#routeCounter}`;
    this.#routeHandles.set(handle, instance);
    return handle;
  }

  #toKebabCase(str: string): string {
    return str
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
}
