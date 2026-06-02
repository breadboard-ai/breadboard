/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Asset,
  AssetPath,
  Edge,
  GraphMetadata,
  LLMContent,
  NodeDescriptor,
} from "@breadboard-ai/types";

import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import type { CanvasController } from "../../../sca/controller/subcontrollers/editor/canvas/canvas-controller.js";
import {
  GENERATE_COMPONENT_URL,
  USER_INPUT_COMPONENT_URL,
  OUTPUT_COMPONENT_URL,
  LEGACY_OPTION_MAP,
} from "./constants.js";

export { graphOverviewYaml, describeSelection };

/**
 * Build a compact YAML-like overview of a graph using pidgin handles.
 *
 * Shows only the data the editing functions can act on: title, prompt
 * (converted to pidgin), and an adjacency list of connections.
 */
function graphOverviewYaml(
  graph: {
    title?: string;
    description?: string;
    metadata?: GraphMetadata;
    assets?: Record<AssetPath, Asset>;
  },
  nodes: NodeDescriptor[],
  edges: Edge[],
  translator: EditingAgentPidginTranslator,
  canvas?: CanvasController
): string {
  // Register all nodes with the translator to get stable pidgin handles.
  const handleMap = new Map<string, string>();
  for (const node of nodes) {
    const handle = translator.getOrCreateHandle(node.id);
    handleMap.set(node.id, handle);
  }

  // Build compact YAML-like output.
  const lines: string[] = [];
  if (graph.title) lines.push(`title: ${graph.title}`);
  if (graph.description) lines.push(`description: ${graph.description}`);

  const presentation = graph.metadata?.visual?.presentation;
  const themeId = presentation?.theme;
  const themes = presentation?.themes;
  const currentTheme =
    themeId && themes ? themes[themeId] : undefined;

  const isCustom =
    !!currentTheme?.splashScreen && !currentTheme?.isDefaultTheme;
  lines.push(`splashImage: ${isCustom ? "present" : "default"}`);

  if (canvas && canvas.viewport && canvas.viewport.width > 0) {
    lines.push("", "viewport:");
    lines.push(`  left: ${Math.round(canvas.viewport.left)}`);
    lines.push(`  top: ${Math.round(canvas.viewport.top)}`);
    lines.push(`  width: ${Math.round(canvas.viewport.width)}`);
    lines.push(`  height: ${Math.round(canvas.viewport.height)}`);
  }

  if (graph.assets && Object.keys(graph.assets).length > 0) {
    lines.push("", "assets:");
    for (const [path, asset] of Object.entries(graph.assets)) {
      const title = asset.metadata?.title ?? "(untitled)";
      const type = inferAssetFriendlyType(asset);
      lines.push(`  ${path}:`);
      lines.push(`    title: ${title}`);
      lines.push(`    type: ${type}`);
      const visual = (asset.metadata?.visual ?? {}) as Record<string, unknown>;
      if (typeof visual.x === "number" && typeof visual.y === "number") {
        lines.push(`    x: ${Math.round(visual.x)}`);
        lines.push(`    y: ${Math.round(visual.y)}`);
      } else {
        lines.push(`    # Newly Added. TODO: Position this asset`);
      }

      if (canvas && typeof canvas.getAssetDimensions === "function") {
        const dims = canvas.getAssetDimensions(path);
        if (dims && dims.height > 0) {
          lines.push(`    width: ${Math.round(dims.width)}`);
          lines.push(`    height: ${Math.round(dims.height)}`);
        }
      }
    }
  }

  lines.push("", "steps:");
  for (const node of nodes) {
    const handle = handleMap.get(node.id)!;
    const title = node.metadata?.title ?? "(untitled)";
    lines.push(`  ${handle}:`);
    lines.push(`    title: ${title}`);

    const visual = (node.metadata?.visual ?? {}) as Record<string, unknown>;
    if (typeof visual.x === "number" && typeof visual.y === "number") {
      lines.push(`    x: ${Math.round(visual.x)}`);
      lines.push(`    y: ${Math.round(visual.y)}`);
    }

    if (canvas && typeof canvas.getStepDimensions === "function") {
      const dims = canvas.getStepDimensions(node.id);
      if (dims && dims.height > 0) {
        lines.push(`    width: ${Math.round(dims.width)}`);
        lines.push(`    height: ${Math.round(dims.height)}`);
      }
    }
    const config = node.configuration as Record<string, unknown> | undefined;

    // Convert prompt back to pidgin for readability
    const prompt =
      config?.["config$prompt"] ||
      config?.["description"] ||
      config?.["text"];

    if (prompt && typeof prompt === "object") {
      const pidgin = translator.toPidgin(prompt as LLMContent);
      if (pidgin.text) {
        // Indent multi-line prompts
        const indented = pidgin.text
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n");
        lines.push(`    prompt: |`);
        lines.push(indented);
      }
    }

    let inferredStepType: string | undefined;
    if (node.type === USER_INPUT_COMPONENT_URL) {
      inferredStepType = "user-input";
    } else if (node.type === OUTPUT_COMPONENT_URL) {
      inferredStepType = "output";
    } else if (node.type === GENERATE_COMPONENT_URL) {
      const genMode =
        config &&
        typeof config === "object" &&
        "generation-mode" in config
          ? (config["generation-mode"] as string)
          : undefined;
      inferredStepType = genMode || "text-3-flash";
    }

    const options: Record<string, unknown> = {};
    if (inferredStepType && LEGACY_OPTION_MAP[inferredStepType]) {
      const optionMap = LEGACY_OPTION_MAP[inferredStepType];
      if (config && typeof config === "object") {
        for (const [optKey, targetKey] of Object.entries(optionMap)) {
          if (targetKey in config && config[targetKey] !== undefined) {
            options[optKey] = config[targetKey];
          }
        }
      }
    }

    if (Object.keys(options).length > 0) {
      lines.push(`    options:`);
      for (const [key, val] of Object.entries(options)) {
        if (typeof val === "string" && val.includes("\n")) {
          const indentedVal = val
            .split("\n")
            .map((l) => `        ${l}`)
            .join("\n");
          lines.push(`      ${key}: |`);
          lines.push(indentedVal);
        } else {
          lines.push(`      ${key}: ${JSON.stringify(val)}`);
        }
      }
    }
  }

  // Adjacency list: group edges by source
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const from = handleMap.get(edge.from);
    const to = handleMap.get(edge.to);
    if (from && to) {
      let targets = adj.get(from);
      if (!targets) {
        targets = [];
        adj.set(from, targets);
      }
      targets.push(to);
    }
  }

  if (adj.size > 0) {
    lines.push("", "connections:");
    for (const [from, targets] of adj) {
      lines.push(`  ${from} -> ${targets.join(", ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Describe the currently selected steps as a short text block.
 * Returns an empty string when nothing is selected.
 */
function describeSelection(
  selectedNodeIds: Set<string>,
  nodes: NodeDescriptor[],
  translator: EditingAgentPidginTranslator
): string {
  if (selectedNodeIds.size === 0) return "";

  const items: string[] = [];
  for (const nodeId of selectedNodeIds) {
    const node = nodes.find((n) => n.id === nodeId);
    const handle = translator.getOrCreateHandle(nodeId);
    const title = node?.metadata?.title ?? "(untitled)";
    items.push(`${handle} (${title})`);
  }
  return `\n\nSelected steps: ${items.join(", ")}`;
}

/**
 * Infer a friendly, user-facing descriptor for an asset.
 */
function inferAssetFriendlyType(asset: Asset): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = asset.data as any[];
  const part = data?.[0]?.parts?.[0];
  const mimeType =
    part?.storedData?.mimeType || part?.inlineData?.mimeType;
  const handle = part?.storedData?.handle;

  if (mimeType) {
    if (typeof mimeType === "string") {
      if (mimeType.startsWith("image/")) return "Image";
      if (mimeType.startsWith("video/")) {
        if (
          mimeType.includes("youtube") ||
          (typeof handle === "string" && handle.includes("youtube.com"))
        ) {
          return "YouTube video";
        }
        return "Video";
      }
      if (mimeType.startsWith("audio/")) return "Audio";
      if (mimeType === "application/x-notebooklm") return "NotebookLM notebook";
      if (mimeType === "text/plain") return "Plain text";
      if (mimeType.startsWith("application/vnd.google-apps.")) {
        const docType = mimeType.replace("application/vnd.google-apps.", "");
        if (docType === "spreadsheet") return "Google Sheets spreadsheet";
        if (docType === "document") return "Google Docs document";
        if (docType === "presentation") return "Google Slides presentation";
        return "Google Drive file";
      }
    }
  }

  const subType = asset.metadata?.subType;
  if (subType) {
    if (subType === "gdrive") return "Google Drive file";
    if (subType === "notebooklm") return "NotebookLM notebook";
    if (subType === "youtube") return "YouTube video";
    if (subType === "drawing") return "Drawing";
    if (subType === "text" || subType === "plain-text") return "Plain text";
  }

  if (typeof handle === "string") {
    if (handle.includes("youtube.com") || handle.includes("youtu.be")) {
      return "YouTube video";
    }
    if (handle.startsWith("drive:")) return "Google Drive file";
  }

  if (typeof mimeType === "string" && mimeType) {
    return mimeType;
  }

  return asset.metadata?.type || "File";
}
