/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, GraphMetadata, LLMContent, NodeDescriptor } from "@breadboard-ai/types";

import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
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
  },
  nodes: NodeDescriptor[],
  edges: Edge[],
  translator: EditingAgentPidginTranslator
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


  lines.push("", "steps:");
  for (const node of nodes) {
    const handle = handleMap.get(node.id)!;
    const title = node.metadata?.title ?? "(untitled)";
    lines.push(`  ${handle}:`);
    lines.push(`    title: ${title}`);

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
