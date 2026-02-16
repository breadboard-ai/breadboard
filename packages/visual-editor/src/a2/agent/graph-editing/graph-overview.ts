/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, LLMContent, NodeDescriptor } from "@breadboard-ai/types";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";

export { graphOverviewYaml };

/**
 * Build a compact YAML-like overview of a graph using pidgin handles.
 *
 * Shows only the data the editing functions can act on: title, prompt
 * (converted to pidgin), and an adjacency list of connections.
 */
function graphOverviewYaml(
  graph: { title?: string; description?: string },
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

  lines.push("", "steps:");
  for (const node of nodes) {
    const handle = handleMap.get(node.id)!;
    const title = node.metadata?.title ?? "(untitled)";
    lines.push(`  ${handle}:`);
    lines.push(`    title: ${title}`);

    // Convert prompt back to pidgin for readability
    const prompt = node.configuration?.["config$prompt"];
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
