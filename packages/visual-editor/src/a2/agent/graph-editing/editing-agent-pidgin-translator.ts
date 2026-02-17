/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import {
  Template,
  type ParamPart,
  type ToolParamPart,
} from "../../a2/template.js";
import { A2_TOOL_MAP, A2_TOOLS } from "../../a2-registry.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
  NOTEBOOKLM_TOOL_PATH,
} from "../../a2/tool-manager.js";

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

  constructor() {}

  toPidgin(content: LLMContent): ToPidginResult {
    const template = new Template(content);

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

  fromPidgin(
    content: string,
    resolveNodeTitle?: (nodeId: string) => string | undefined
  ): LLMContent {
    const segments = content.split(SPLIT_REGEX);
    const textParts: string[] = [];

    for (const segment of segments) {
      if (segment === "") continue;

      const parentMatch = segment.match(PARENT_PARSE_REGEX);
      if (parentMatch) {
        const handle = parentMatch[1];
        // Resolve handle to node ID, or use the handle itself if it's already
        // a raw node ID (e.g. from graph_get_overview).
        const nodePath = this.getNodeId(handle) ?? handle;
        // Use the node's actual title if a resolver is provided
        const title = resolveNodeTitle?.(nodePath) ?? handle;
        textParts.push(Template.part({ type: "in", path: nodePath, title }));
        continue;
      }

      const fileMatch = segment.match(FILE_PARSE_REGEX);
      if (fileMatch) {
        const path = fileMatch[1];
        textParts.push(Template.part({ type: "asset", path, title: path }));
        continue;
      }

      const toolMatch = segment.match(TOOL_PARSE_REGEX);
      if (toolMatch) {
        const name = toolMatch[1];
        const resolved = this.#resolveToolName(name);
        // Always generate a chip; use resolved title or fallback to name
        textParts.push(
          Template.part({
            type: "tool",
            path: resolved?.path ?? name,
            title: resolved?.title ?? name,
          })
        );
        continue;
      }

      const linkMatch = segment.match(LINK_PARSE_REGEX);
      if (linkMatch) {
        const routeHandle = linkMatch[1];
        const title = linkMatch[2].trim();
        const instance = this.getOriginalRoute(routeHandle);
        if (instance) {
          const part: ToolParamPart = {
            type: "tool",
            path: ROUTE_TOOL_PATH,
            title,
            instance,
          };
          textParts.push(Template.part(part));
        } else {
          textParts.push(segment);
        }
        continue;
      }

      textParts.push(segment);
    }

    const joined = textParts.join("");
    return { parts: [{ text: joined }], role: "user" };
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

  /**
   * Register a node ID and return (or reuse) its pidgin handle.
   */
  getOrCreateHandle(nodeId: string): string {
    return this.#getOrCreateParentHandle(nodeId);
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

  /**
   * Resolve a tool friendly name to its path, handling
   * well-known names (memory, notebooklm) and reverse lookups.
   */
  #resolveToolName(name: string): { path: string; title: string } | undefined {
    if (name === "memory") return { path: MEMORY_TOOL_PATH, title: "Memory" };
    if (name === "notebooklm")
      return { path: NOTEBOOKLM_TOOL_PATH, title: "NotebookLM" };
    // Prefer A2_TOOLS lookup — it has the proper display title
    for (const [url, tool] of A2_TOOLS) {
      if (tool.title && this.#toKebabCase(tool.title) === name) {
        return { path: url, title: tool.title };
      }
    }
    // Fallback: reverse map (populated by prior toPidgin calls)
    const fromReverse = this.#toolReverse.get(name);
    if (fromReverse) return { path: fromReverse, title: name };
    return undefined;
  }
}
