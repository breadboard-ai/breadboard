/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  GraphDescriptor,
  InspectableEdge,
  InspectableNode,
  InspectableEdgeType,
} from "@breadboard-ai/types";
import { icons } from "../../../../src/ui/styles/icons.js";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { Graph } from "../../../../src/ui/elements/step-editor/graph.js";
import { MAIN_BOARD_ID } from "../../../../src/sca/constants.js";
import { provide } from "@lit/context";
import { scaContext } from "../../../../src/sca/context/context.js";
import { ok } from "@breadboard-ai/utils";
import { UserNote, NoteLocation } from "../types.js";
import "./notes-container.js";
import { A2_TOOLS } from "../../../../src/a2/a2-registry.js";
import "../../../../src/ui/elements/graph-editing-chat/opie-avatar.js";
import "../../../../src/ui/elements/json-tree/json-tree.js";
import { parseThought } from "../../../../src/a2/agent/thought-parser.js";
import {
  A2_COMPONENT_MAP,
  A2_TOOL_MAP,
} from "../../../../src/a2/a2-registry.js";
import { computePositions } from "./layout-graph.js";

const PARSING_REGEX = /{(?<json>{(?:.*?)})}/gim;

function isTemplatePart(o: unknown): o is any {
  if (!o || typeof o !== "object") return false;
  return "type" in o && "path" in o && "title" in o;
}

function splitToParts(value: string): any[] {
  const parts: any[] = [];
  const matches = value.matchAll(PARSING_REGEX);
  let start = 0;

  for (const match of matches) {
    const json = match.groups?.json;
    const end = match.index;
    if (end > start) {
      parts.push(value.slice(start, end));
    }
    if (json) {
      let maybeTemplatePart;
      try {
        maybeTemplatePart = JSON.parse(json);
        if (isTemplatePart(maybeTemplatePart)) {
          parts.push(maybeTemplatePart);
        } else {
          maybeTemplatePart = null;
        }
      } catch {
        // do nothing
      } finally {
        if (!maybeTemplatePart) {
          parts.push(value.slice(end, end + match[0].length));
        }
      }
    }
    start = end + match[0].length;
  }
  if (start < value.length) {
    parts.push(value.slice(start));
  }
  const merged: any[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const last = merged.at(-1);
      if (last && typeof last === "string") {
        merged[merged.length - 1] = last + part;
        continue;
      }
    }
    merged.push(part);
  }
  return merged;
}

export { BGLViewer };

@customElement("bgl-viewer")
class BGLViewer extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor rater: Record<string, unknown> | null = null;

  @property()
  accessor transcript: unknown[] | null = null;

  @property()
  accessor notes: UserNote[] = [];


  @provide({ context: scaContext })
  accessor sca: any = {
    controller: {
      editor: {
        graph: {
          getMetadataForNode: (id: string, _gId: string) => {
            const node = this.graph?.nodes.find((n: any) => n.id === id);
            const a2Component = node ? A2_COMPONENT_MAP.get(node.type) : undefined;
            return ok({
              icon: node?.metadata?.icon || a2Component?.icon || "hub",
              tags: node?.metadata?.tags || [],
            });
          },
          getPortsForNode: (_id: string, _gId: string) =>
            ok({
              inputs: { ports: [] },
              outputs: { ports: [] },
            }),
          getTitleForNode: (id: string, _gId: string) => {
            const node = this.graph?.nodes.find((n: any) => n.id === id);
            const a2Component = node ? A2_COMPONENT_MAP.get(node.type) : undefined;
            return ok(node?.metadata?.title || a2Component?.title || id);
          },
          tools: new Map(A2_TOOLS),
          graphAssets: new Map(),
        },
        integrations: {
          registered: new Map(),
        },
      },
    },
    env: {
      flags: {
        get: (_flag: string) => false,
      },
    },
  };

  @state()
  accessor #graphComponent: Graph | null = null;

  @state()
  accessor #selectedNode: any = null;

  #dialogRef: Ref<HTMLDialogElement> = createRef();
  #raterDialogRef: Ref<HTMLDialogElement> = createRef();
  #transcriptDialogRef: Ref<HTMLDialogElement> = createRef();
  #allNotesDialogRef: Ref<HTMLDialogElement> = createRef();

  static styles = [
    icons,
    css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      background: var(--light-dark-n-95);
      overflow: hidden;
    }

    #container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      transform: translate(0, 0);
      contain: strict;
      overflow: hidden;
    }

    #bgl-header {
      position: absolute;
      top: var(--bb-grid-size-5);
      left: var(--bb-grid-size-6);
      right: var(--bb-grid-size-6);
      z-index: 10;
      pointer-events: none;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--bb-grid-size-4);

      h1 {
        margin: 0 0 var(--bb-grid-size) 0;
        font-size: 22px;
        font-weight: 500;
        color: light-dark(var(--n-10), var(--n-90));
      }

      p {
        margin: 0;
        font-size: 14px;
        color: light-dark(var(--n-30), var(--n-70));
        line-height: 1.5;
      }
    }

    #rater-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--bb-grid-size-2);
      background: var(--light-dark-n-100);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
      border-radius: var(--bb-grid-size-4);
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px oklch(from var(--light-dark-n-10) l c h / 0.1);
      font-size: 13px;
      font-weight: 500;
      color: var(--light-dark-n-0);
      flex-shrink: 0;

      .status-row {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        margin-bottom: var(--bb-grid-size);
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;

        &.pass { background: #34a853; }
        &.fail { background: #ea4335; }
        &.partial { background: #fbbc04; }
        &.unknown { background: #9aa0a6; }
      }

      button {
        background: var(--light-dark-n-95);
        color: var(--light-dark-n-10);
        border: 1px solid var(--border-color);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-2);
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: background 0.2s, color 0.2s;
        pointer-events: auto;
        width: 100%;
        text-align: center;

        &:hover {
          background: var(--light-dark-n-90);
          color: var(--light-dark-n-0);
        }
      }
    }

    dialog[open] {
      display: flex;
      flex-direction: column;
      max-height: 85vh;
    }

    dialog {
      border: none;
      border-radius: var(--bb-grid-size-4);
      padding: var(--bb-grid-size-6);
      background: var(--light-dark-n-100);
      color: var(--light-dark-n-0);
      box-shadow: 0 16px 48px oklch(from var(--light-dark-n-10) l c h / 0.3);
      max-width: 720px;
      width: 85vw;
      font-family: var(--font-family);

      &::backdrop {
        background: oklch(from var(--light-dark-n-10) l c h / 0.5);
        backdrop-filter: blur(4px);
      }

      form {
        margin: 0;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-height: 0;
        overflow: hidden;
      }

      #dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--bb-grid-size-4);
        flex-shrink: 0;

        h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
        }

        button {
          background: none;
          border: none;
          color: var(--light-dark-n-60);
          cursor: pointer;
          padding: var(--bb-grid-size-2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s cubic-bezier(0, 0, 0.3, 1), color 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover {
            background: var(--light-dark-n-95);
            color: var(--light-dark-n-0);
          }
        }
      }

      #dialog-body {
        overflow-y: auto;
        flex-grow: 1;
        min-height: 0;

        .dimensions-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: var(--bb-grid-size-2);
          font-size: 13px;
          line-height: 1.5;
          color: var(--light-dark-n-10);
          background: var(--light-dark-n-98);
          border-radius: var(--bb-grid-size-2);
          overflow: hidden;

          th {
            background: var(--light-dark-n-90);
            color: var(--light-dark-n-0);
            text-align: left;
            font-weight: 600;
            padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
          }

          td {
            border-bottom: 1px solid var(--border-color);
            padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
            vertical-align: top;

            &:first-child {
              color: var(--light-dark-n-0);
              white-space: nowrap;
            }

            &.score-cell {
              font-weight: 600;
              white-space: nowrap;
              color: var(--light-dark-n-0);
            }
          }

          tr:last-child td {
            border-bottom: none;
          }
        }

        pre {
          background: var(--light-dark-n-95);
          padding: var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-2);
          margin: 0;
          white-space: pre-wrap;
          font-family: var(--font-family-mono);
          font-size: 13px;
          line-height: 1.6;
          color: var(--light-dark-n-10);

          .chip-chiclet {
            display: inline-flex;
            background: oklch(from var(--primary) l c h / calc(alpha * 0.18));
            border: 1px solid oklch(from var(--primary) l c h / calc(alpha * 0.3));
            border-radius: var(--bb-grid-size-4);
            padding: 1px var(--bb-grid-size-2) 1px var(--bb-grid-size);
            font-size: 11px;
            font-weight: 500;
            color: var(--light-dark-n-0);
            margin: 0 3px;
            vertical-align: text-bottom;
            height: 18px;
            line-height: 16px;
            box-sizing: border-box;

            &.invalid {
              border-color: var(--light-dark-e-40);
              background: oklch(from var(--light-dark-e-40) l c h / 0.15);
              color: var(--light-dark-e-20);

              & .g-icon {
                color: var(--light-dark-e-20);
              }
            }

            .g-icon {
              font-size: 13px;
              width: 14px;
              height: 14px;
              margin-right: var(--bb-grid-size);
              color: var(--primary);
              vertical-align: middle;
            }
          }
        }

        .config-item {
          margin-bottom: var(--bb-grid-size-4);

          &:last-child {
            margin-bottom: 0;
          }

          h3 {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 var(--bb-grid-size-2) 0;
            color: var(--light-dark-n-40);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        }

        .disconnect-banner {
          display: flex;
          align-items: flex-start;
          gap: var(--bb-grid-size-3);
          padding: var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-3);
          margin-bottom: var(--bb-grid-size-3);
          background: var(--elevated-background-light);
          border: 1px solid var(--border-color);
        }

        .disconnect-banner.detected {
          background: oklch(from #ea4335 l c h / 0.08);
          border-color: oklch(from #ea4335 l c h / 0.3);
        }

        .disconnect-banner.cleared {
          background: oklch(from #34a853 l c h / 0.08);
          border-color: oklch(from #34a853 l c h / 0.3);
        }

        .disconnect-banner .g-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .disconnect-banner.detected .g-icon {
          color: #ea4335;
        }

        .disconnect-banner.cleared .g-icon {
          color: #34a853;
        }

        .disconnect-banner h4 {
          margin: 0 0 var(--bb-grid-size) 0;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
        }

        .disconnect-banner p {
          margin: 0 0 var(--bb-grid-size-2) 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--light-dark-n-10);
        }

        .disconnect-banner .severity {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: #ea4335;
          background: oklch(from #ea4335 l c h / 0.12);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid oklch(from #ea4335 l c h / 0.3);
        }
      }

    `,
  ];

  protected updated(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("graph")) {
      this.#rebuildGraph();
    }
  }

  #rebuildGraph() {
    if (!this.graph) {
      this.#graphComponent = null;
      return;
    }

    const graphDescriptor = JSON.parse(JSON.stringify(this.graph)) as GraphDescriptor;
    const graphNodes = graphDescriptor.nodes || [];
    const graphEdges = graphDescriptor.edges || [];

    const allNodesAtZero = graphNodes.every((node) => {
      const visual = (node.metadata?.visual || {}) as any;
      return typeof visual.x !== "number" || typeof visual.y !== "number" || (visual.x === 0 && visual.y === 0);
    });

    if (allNodesAtZero && graphNodes.length > 0) {
      const positions = computePositions(graphNodes, graphEdges);
      for (const node of graphNodes) {
        const pos = positions.get(node.id);
        if (pos) {
          if (!node.metadata) {
            node.metadata = {};
          }
          if (!node.metadata.visual) {
            node.metadata.visual = {};
          }
          (node.metadata.visual as any).x = pos.x;
          (node.metadata.visual as any).y = pos.y;
        }
      }
    }

    const graphComponent = new Graph(MAIN_BOARD_ID);
    const nodes = graphNodes.map((nodeDescriptor) => {
      const inspectableNode: InspectableNode = {
        descriptor: nodeDescriptor,
        title: () => nodeDescriptor.metadata?.title || nodeDescriptor.id,
        description: () =>
          nodeDescriptor.metadata?.description ||
          nodeDescriptor.metadata?.title ||
          nodeDescriptor.id,
        incoming: () => [],
        outgoing: () => [],
        isEntry: () => false,
        isExit: () => false,
        isStart: () => false,
        type: () => {
          const a2Component = A2_COMPONENT_MAP.get(nodeDescriptor.type);
          const a2Tool = A2_TOOL_MAP.get(nodeDescriptor.type);
          const icon =
            nodeDescriptor.metadata?.icon ||
            a2Component?.icon ||
            a2Tool?.icon ||
            undefined;
          const tags =
            nodeDescriptor.metadata?.tags ||
            (a2Component as any)?.category ? [ (a2Component as any).category ] :
            [];

          return {
            currentMetadata: () => ({
              icon,
              tags,
            }),
            type: () => nodeDescriptor.type,
          } as any;
        },
        configuration: () => nodeDescriptor.configuration || {},
        metadata: () => nodeDescriptor.metadata || {},
        describe: async () =>
          ({
            current: { inputSchema: {}, outputSchema: {} },
            latest: { inputSchema: {}, outputSchema: {} },
          }) as any,
        currentDescribe: () =>
          ({
            current: { inputSchema: {}, outputSchema: {} },
            latest: { inputSchema: {}, outputSchema: {} },
          }) as any,
        currentPorts: () => {
          const config = nodeDescriptor.configuration || {};
          const synthesizedPorts = Object.entries(config).map(([key, value]) => {
            return {
              name: key,
              title: key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
              value: value,
              schema: {
                type: typeof value === "object" && value !== null ? "object" : "string",
                behavior: ["hint-preview", "llm-content"],
              },
            };
          });

          return {
            inputs: { ports: synthesizedPorts },
            outputs: { ports: [] },
            updating: false,
          } as any;
        },
        ports: async () =>
          ({
            inputs: { ports: [] },
            outputs: { ports: [] },
            updating: false,
          }) as any,
        routes: () => [],
      };
      return inspectableNode;
    });

    const nodesLookup = new Map<string, InspectableNode>();
    for (const node of nodes) {
      nodesLookup.set(node.descriptor.id, node);
    }

    const edges = graphEdges.map((edgeDescriptor) => {
      const inspectableEdge: InspectableEdge = {
        raw: () => edgeDescriptor,
        get from() {
          return nodesLookup.get(edgeDescriptor.from)!;
        },
        get to() {
          return nodesLookup.get(edgeDescriptor.to)!;
        },
        get out() {
          return (edgeDescriptor.out as string) || "";
        },
        get in() {
          return edgeDescriptor.out === "*"
            ? "*"
            : (edgeDescriptor.in as string) || "";
        },
        get type() {
          if (edgeDescriptor.out === "*") return InspectableEdgeType.Star;
          if (edgeDescriptor.out === "") return InspectableEdgeType.Control;
          if (edgeDescriptor.constant) return InspectableEdgeType.Constant;
          return InspectableEdgeType.Ordinary;
        },
        metadata: () => edgeDescriptor.metadata || {},
        outPort: () => undefined as any,
        inPort: () => undefined as any,
      };
      return inspectableEdge;
    });

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of graphNodes) {
      const visual = (node.metadata?.visual || {}) as any;
      const x = visual.x ?? 0;
      const y = visual.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    graphComponent.boundsLabel = this.graph.title || "Topology";
    graphComponent.nodes = nodes;
    graphComponent.edges = edges;
    graphComponent.readOnly = true;
    graphComponent.allowEdgeAttachmentMove = false;
    graphComponent.resetTransform();

    // Call updateEntity to arrange the nodes and compute world transforms
    requestAnimationFrame(() => {
      try {
        const rect = this.getBoundingClientRect();
        const W = rect.width > 0 ? rect.width : 800;
        const H = rect.height > 0 ? rect.height : 600;

        if (
          Number.isFinite(minX) &&
          Number.isFinite(maxX) &&
          Number.isFinite(minY) &&
          Number.isFinite(maxY)
        ) {
          const maxXWithWidth = maxX + 300;
          const maxYWithHeight = maxY + 150;
          const graphWidth = maxXWithWidth - minX;
          const graphHeight = maxYWithHeight - minY;

          const centerX = minX + graphWidth / 2;
          const centerY = minY + graphHeight / 2;

          const padding = 128;
          const paddedW = Math.max(W - padding, 200);
          const paddedH = Math.max(H - padding, 200);

          const scaleX = paddedW / graphWidth;
          const scaleY = paddedH / graphHeight;

          let scale = Math.min(scaleX, scaleY);
          scale = Math.max(0.1, Math.min(1.0, scale));

          graphComponent.transform.a = scale;
          graphComponent.transform.d = scale;

          graphComponent.transform.e = W / 2 - centerX * scale;
          graphComponent.transform.f = H / 2 - centerY * scale;
        }

        graphComponent.updateEntity();
        this.requestUpdate();
      } catch (err) {
        console.warn("BGLViewer: updateEntity failed", err);
      }
    });

    this.#graphComponent = graphComponent;
  }

  #showModal(node: any) {
    this.#selectedNode = node;
    this.requestUpdate();
    requestAnimationFrame(() => {
      this.#dialogRef.value?.showModal();
    });
  }

  #getNotesForLocation(location: NoteLocation): UserNote[] {
    if (!this.notes) return [];
    return this.notes.filter((note) => {
      const loc = note.location;
      if (loc.type !== location.type) return false;

      if (loc.type === "node-config" && location.type === "node-config") {
        return loc.nodeId === location.nodeId && loc.fieldName === location.fieldName;
      }
      if (loc.type === "rater" && location.type === "rater") {
        return loc.dimension === location.dimension && loc.fieldName === location.fieldName;
      }
      if (loc.type === "transcript" && location.type === "transcript") {
        return loc.turn === location.turn && loc.eventIndex === location.eventIndex && loc.fieldName === location.fieldName;
      }
      return false;
    });
  }

  #renderModal() {
    if (!this.#selectedNode) {
      return nothing;
    }

    const config = this.#selectedNode.configuration || {};
    const metadata = this.#selectedNode.metadata || {};
    const title = metadata.title || this.#selectedNode.id;

    return html`<dialog ${ref(this.#dialogRef)}>
      <form method="dialog">
        <div id="dialog-header">
          <h2>${title}</h2>
          <button type="submit" aria-label="Close">
            <span class="g-icon filled round">close</span>
          </button>
        </div>
        <div id="dialog-body">
          <div class="config-item">
            <h3>Type</h3>
            <pre>${this.#selectedNode.type}</pre>
          </div>
          ${Object.entries(config).map(([key, value]) => {
            let isLLMContent = false;
            let formattedValue: any = typeof value === "string" ? value : JSON.stringify(value, null, 2);
            if ((key === "config$prompt" || key === "description" || key === "text") && typeof value === "object" && value !== null && "parts" in (value as any)) {
              isLLMContent = true;
              const parts = (value as any).parts || [];
              const textParts = parts.filter((p: any) => typeof p.text === "string").map((p: any) => p.text);
              if (textParts.length > 0) {
                formattedValue = textParts.join("\n\n");
              }
            }

            const renderChiclets = (text: string) => {
              const parts = splitToParts(text);
              return parts.map((part) => {
                if (typeof part === "string") {
                  return html`${part}`;
                }

                let icon: any = "hub";
                let title = part.title || part.path;

                if (part.type === "tool") {
                  const toolInfo = A2_TOOL_MAP.get(part.path);
                  if (toolInfo) {
                    icon = toolInfo.icon || "spark";
                    title = toolInfo.title || title;
                  } else {
                    icon = "spark";
                  }
                } else if (part.type === "in") {
                  const sourceNode = this.graph?.nodes.find((n: any) => n.id === part.path);
                  if (sourceNode) {
                    const a2Component = A2_COMPONENT_MAP.get(sourceNode.type);
                    icon = sourceNode.metadata?.icon || a2Component?.icon || "arrow_forward";
                    title = sourceNode.metadata?.title || a2Component?.title || title;
                  } else {
                    icon = "arrow_forward";
                  }
                } else if (part.type === "asset") {
                  icon = "attach_file";
                }

                if (icon === "ask-user") {
                  icon = "chat_mirror";
                }

                const classes = {
                  "chip-chiclet": true,
                  "invalid": !!part.invalid,
                  "tool": part.type === "tool",
                  "asset": part.type === "asset",
                  "in": part.type === "in",
                };

                return html`<span class=${classMap(classes)} title=${part.path}>
                  <span class="g-icon filled round">${icon}</span>
                  ${title}
                </span>`;
              });
            };

            const location: NoteLocation = {
              type: "node-config",
              nodeId: this.#selectedNode.id,
              fieldName: key,
            };

            return html`<div class="config-item">
              <h3>${key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}</h3>
              <pre>${isLLMContent && typeof formattedValue === "string" ? renderChiclets(formattedValue) : formattedValue}</pre>
              <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
            </div>`;
          })}
        </div>
      </form>
    </dialog>`;
  }

  #showRaterModal() {
    this.requestUpdate();
    requestAnimationFrame(() => {
      this.#raterDialogRef.value?.showModal();
    });
  }

  #renderRaterModal() {
    if (!this.rater) {
      return nothing;
    }

    const title = "Evaluation Results";

    return html`<dialog ${ref(this.#raterDialogRef)}>
      <form method="dialog">
        <div id="dialog-header">
          <h2>${title}</h2>
          <button type="submit" aria-label="Close">
            <span class="g-icon filled round">close</span>
          </button>
        </div>
        <div id="dialog-body">
          ${(() => {
            const raterObj = this.rater || {};
            const overallJudgement = (raterObj as any)?.overall_judgement;
            if (!overallJudgement) return nothing;

            const isPass = overallJudgement === 'PASS';
            const isPartial = overallJudgement === 'PARTIAL';
            const isFail = overallJudgement === 'FAIL';
            const color = isPass ? '#34a853' : (isPartial ? '#fbbc04' : (isFail ? '#ea4335' : 'var(--light-dark-n-60)'));
            const bgColor = isPass ? 'oklch(from #34a853 l c h / 0.12)' : (isPartial ? 'oklch(from #fbbc04 l c h / 0.12)' : (isFail ? 'oklch(from #ea4335 l c h / 0.12)' : 'var(--elevated-background-light)'));
            const borderColor = isPass ? '#34a853' : (isPartial ? '#fbbc04' : (isFail ? '#ea4335' : 'var(--border-color)'));
            const icon = isPass ? 'check_circle' : (isPartial ? 'warning' : (isFail ? 'cancel' : 'info'));
            
            const location: NoteLocation = {
              type: "rater",
              fieldName: "overall_judgement",
            };

            return html`<div style="background: ${bgColor}; border: 1px solid oklch(from ${borderColor} l c h / 0.4); border-radius: var(--bb-grid-size-3); padding: var(--bb-grid-size-4); margin-bottom: var(--bb-grid-size-5); display: flex; flex-direction: column; gap: var(--bb-grid-size-3);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: var(--bb-grid-size-3);">
                  <span class="g-icon filled round" style="color: ${color}; font-size: 28px;">${icon}</span>
                  <div>
                    <h3 style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--light-dark-n-40); letter-spacing: 0.5px; margin: 0 0 4px 0;">Overall Judgement</h3>
                    <div style="font-size: 22px; font-weight: 700; color: var(--light-dark-n-0);">${overallJudgement}</div>
                  </div>
                </div>
                ${(() => {
                  const humanReactionNote = Array.isArray(this.notes) 
                    ? this.notes.find((n) => n.location.type === "rater" && n.location.fieldName === "overall_judgement" && n.reaction)
                    : null;
                  const humanReaction = humanReactionNote?.reaction;
                  if (!humanReaction) return nothing;

                  const isGood = humanReaction === "good";
                  const hColor = isGood ? "#34a853" : "#ea4335";
                  const hText = isGood ? "Human Agrees" : "Marked AI Wrong";
                  const hIcon = isGood ? "thumb_up" : "thumb_down";

                  return html`<div style="display: flex; align-items: center; gap: var(--bb-grid-size-2); font-size: 12px; font-weight: 600; background: var(--light-dark-n-100); padding: var(--bb-grid-size-2) var(--bb-grid-size-3); border-radius: 20px; border: 1px solid var(--border-color); color: ${hColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <span class="g-icon filled round" style="font-size: 14px; color: ${hColor};">${hIcon}</span>
                    <span>${hText}</span>
                  </div>`;
                })()}
              </div>
              <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
            </div>`;
          })()}
          ${(this.rater as any)?.disconnects_diagnosis ? this.#renderDisconnectsDiagnosis((this.rater as any).disconnects_diagnosis) : nothing}
          ${Object.entries(this.rater || {}).filter(([k]) => k !== "overall_judgement" && k !== "disconnects_diagnosis").map(([key, value]) => {

            if (key === "dimensions" && typeof value === "object" && value !== null) {
              return html`<div class="config-item">
                <h3>Dimensions</h3>
                <table class="dimensions-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(value).map(([dimKey, dimVal]: [string, any]) => {
                      const category = dimKey.replace(/_/g, " ").replace(/^./, (str) => str.toUpperCase());
                      const score = dimVal?.score ?? "-";
                      const rationale = dimVal?.rationale ?? "";
                      const location: NoteLocation = {
                        type: "rater",
                        dimension: dimKey,
                      };
                      return html`<tr>
                        <td><strong>${category}</strong></td>
                        <td class="score-cell">${score}/5</td>
                        <td>
                          <div>${rationale}</div>
                          <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
                        </td>
                      </tr>`;
                    })}
                  </tbody>
                </table>
              </div>`;
            }

            const formattedValue = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
            const location: NoteLocation = {
              type: "rater",
              fieldName: key,
            };
            return html`<div class="config-item">
              <h3>${key.replace(/_/g, " ").replace(/^./, (str) => str.toUpperCase())}</h3>
              <pre>${formattedValue}</pre>
              <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
            </div>`;
          })}
        </div>
      </form>
    </dialog>`;
  }

  #renderDisconnectsDiagnosis(diagnosis: any) {
    if (!diagnosis) return nothing;

    const cantBuild = diagnosis.we_cant_build_that;
    const misunderstoodUser = diagnosis.we_misunderstood_the_user;
    const misunderstoodOurselves = diagnosis.we_misunderstood_ourselves;

    const renderBanner = (title: string, severity: number, explanation: string, detected: boolean, locationKey: string) => {
      const icon = detected ? 'warning' : 'check_circle';
      const className = detected ? 'detected' : 'cleared';
      const location: NoteLocation = {
        type: "rater",
        fieldName: locationKey,
      };

      let displayExplanation = explanation;
      if (!detected) {
        displayExplanation = explanation.replace(/^(?:None\.|No issues detected\.)\s*/i, "");
        if (!displayExplanation) {
           displayExplanation = "No issues detected.";
        }
      }

      return html`<div class="disconnect-banner ${className}">
        <span class="g-icon filled round">${icon}</span>
        <div style="flex-grow: 1;">
          <h4>
            <span>${title}</span> 
            ${detected && severity > 0 ? html`<span class="severity">Severity: ${severity}/5</span>` : nothing}
          </h4>
          <p>${displayExplanation}</p>
          <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
        </div>
      </div>`;
    };

    return html`<div class="config-item">
      <h3>Root Cause Diagnosis</h3>
      <div style="margin-top: var(--bb-grid-size-4);">
        ${renderBanner("Disconnect 1: 'We can't build that'", cantBuild.severity, cantBuild.explanation, cantBuild.detected, "we_cant_build_that")}
        ${renderBanner("Disconnect 2: 'We misunderstood the user'", misunderstoodUser.severity, misunderstoodUser.explanation, misunderstoodUser.detected, "we_misunderstood_the_user")}
        ${renderBanner("Disconnect 3: 'We misunderstood ourselves'", misunderstoodOurselves.severity, misunderstoodOurselves.explanation, misunderstoodOurselves.detected, "we_misunderstood_ourselves")}
      </div>
    </div>`;
  }

  #showTranscriptModal() {
    this.requestUpdate();
    requestAnimationFrame(() => {
      this.#transcriptDialogRef.value?.showModal();
    });
  }

  #renderTranscriptModal() {
    if (!this.transcript || this.transcript.length === 0) {
      return nothing;
    }

    return html`<dialog ${ref(this.#transcriptDialogRef)}>
      <form method="dialog">
        <div id="dialog-header">
          <h2>Agent Session Transcript</h2>
          <button type="submit" aria-label="Close">
            <span class="g-icon filled round">close</span>
          </button>
        </div>
        <div id="dialog-body" style="padding: var(--bb-grid-size-4); display: flex; flex-direction: column; gap: var(--bb-grid-size-4);">
          ${this.transcript.map((turn: any) => {
            const eventsHtml = (turn.events || []).map((evt: any, eventIndex: number) => {
              const location: NoteLocation = {
                type: "transcript",
                turn: turn.turn,
                eventIndex,
              };

              if (evt.type === "objective") {
                return html`<div class="config-item" style="background: var(--light-dark-n-95); padding: var(--bb-grid-size-3); border-radius: var(--bb-grid-size-2); margin-bottom: var(--bb-grid-size-2);">
                  <h4 style="margin: 0 0 var(--bb-grid-size-2) 0; color: var(--primary);">Objective</h4>
                  <pre style="white-space: pre-wrap; font-family: monospace; margin: 0; font-size: 12px; color: var(--light-dark-n-20);">${evt.text}</pre>
                  <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
                </div>`;
              }
              if (evt.type === "thought") {
                const parsed = parseThought(evt.text);
                return html`<div style="border-left: 3px solid var(--primary); padding-left: var(--bb-grid-size-3); margin-bottom: var(--bb-grid-size-2);">
                  <h4 style="margin: 0 0 var(--bb-grid-size-1) 0; color: var(--light-dark-n-40);">${parsed.title || "Thoughts"}</h4>
                  <div style="font-style: italic; font-size: 13px; color: var(--light-dark-n-40); white-space: pre-wrap;">${parsed.body}</div>
                  <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
                </div>`;
              }
              if (evt.type === "functionCall") {
                return html`<div style="background: var(--elevated-background-light); border: 1px solid var(--border-color); border-radius: var(--bb-grid-size-2); padding: var(--bb-grid-size-3); display: flex; flex-direction: column; gap: var(--bb-grid-size-2); margin-bottom: var(--bb-grid-size-2);">
                  <div style="display: flex; align-items: center; gap: var(--bb-grid-size-2);">
                    <strong style="font-size: 13px; color: var(--light-dark-n-10);">${evt.name}</strong>
                    <span style="background: oklch(from var(--primary) l c h / 0.15); color: var(--primary); font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid oklch(from var(--primary) l c h / 0.25);">call</span>
                  </div>
                  <bb-json-tree .json=${evt.args as any} autoExpand></bb-json-tree>
                  <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
                </div>`;
              }
              if (evt.type === "functionResponse") {
                const responseData = evt.parts && evt.parts.length > 0 ? (evt.parts[0] as any)?.functionResponse?.response ?? evt.parts : {};
                const functionName = evt.parts && evt.parts.length > 0 ? (evt.parts[0] as any)?.functionResponse?.name ?? "response" : "response";
                return html`<div style="background: var(--elevated-background-light); border: 1px solid var(--border-color); border-radius: var(--bb-grid-size-2); padding: var(--bb-grid-size-3); display: flex; flex-direction: column; gap: var(--bb-grid-size-2); margin-bottom: var(--bb-grid-size-2);">
                  <div style="display: flex; align-items: center; gap: var(--bb-grid-size-2);">
                    <strong style="font-size: 13px; color: var(--light-dark-n-10);">${functionName}</strong>
                    <span style="background: oklch(0.75 0.12 150 / 0.15); color: oklch(0.75 0.12 150); font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid oklch(0.75 0.12 150 / 0.25);">response</span>
                  </div>
                  <bb-json-tree .json=${responseData as any}></bb-json-tree>
                  <ui-notes-container .location=${location} .notes=${this.#getNotesForLocation(location)}></ui-notes-container>
                </div>`;
              }
              if (evt.type === "usageMetadata") {
                const meta = evt.metadata || {};
                return html`<div class="config-item" style="font-size: 11px; color: var(--light-dark-n-50); margin-top: var(--bb-grid-size-2); margin-bottom: var(--bb-grid-size-2);">
                  <span>Tokens: Prompt: ${meta.promptTokenCount ?? '-'} | Cached: ${meta.cachedContentTokenCount ?? '-'} | Output: ${meta.candidatesTokenCount ?? '-'} | Total: ${meta.totalTokenCount ?? '-'}</span>
                </div>`;
              }
              return nothing;
            });

            return html`<div class="turn-record" style="padding-bottom: var(--bb-grid-size-4); display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; gap: var(--bb-grid-size-3); margin-bottom: var(--bb-grid-size-4); font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--light-dark-n-60); letter-spacing: 0.5px;">
                <span>Turn ${turn.turn}</span>
                <div style="flex-grow: 1; height: 1px; background: var(--light-dark-n-80);"></div>
              </div>
              ${eventsHtml}
            </div>`;
          })}
        </div>
      </form>
    </dialog>`;
  }

  #showAllNotesModal() {
    this.requestUpdate();
    requestAnimationFrame(() => {
      this.#allNotesDialogRef.value?.showModal();
    });
  }



  #getSectionTitle(location: NoteLocation): string {
    if (location.type === "node-config") {
      const node = this.graph?.nodes.find((n: any) => n.id === location.nodeId);
      const a2Component = node ? A2_COMPONENT_MAP.get(node.type) : undefined;
      const title = node?.metadata?.title || a2Component?.title || location.nodeId;
      return `Node: ${title}`;
    }
    if (location.type === "rater") {
      const category = location.dimension ? location.dimension.replace(/_/g, " ").replace(/^./, (str) => str.toUpperCase()) : "General";
      return `Eval: ${category}`;
    }
    if (location.type === "transcript") {
      return `Transcript: Turn ${location.turn}`;
    }
    return "Other";
  }

  #getFieldReference(location: NoteLocation): string {
    if (location.type === "node-config") {
      return location.fieldName;
    }
    if (location.type === "rater") {
      return location.fieldName ? location.fieldName.replace(/_/g, " ").replace(/^./, (str) => str.toUpperCase()) : "";
    }
    if (location.type === "transcript") {
      return `Event ${location.eventIndex + 1}`;
    }
    return "";
  }

  #renderAllNotesModal() {
    const allNotes = Array.isArray(this.notes) ? this.notes : [];
    if (allNotes.length === 0) {
      return html`<dialog ${ref(this.#allNotesDialogRef)}>
        <form method="dialog">
          <div id="dialog-header">
            <h2>All Comments</h2>
            <button type="submit" aria-label="Close">
              <span class="g-icon filled round">close</span>
            </button>
          </div>
          <div id="dialog-body" style="padding: var(--bb-grid-size-4); color: var(--light-dark-n-40);">
            No comments added yet for this evaluation.
          </div>
        </form>
      </dialog>`;
    }

    const groups = new Map<string, UserNote[]>();
    for (const note of allNotes) {
      const section = this.#getSectionTitle(note.location);
      if (!groups.has(section)) {
        groups.set(section, []);
      }
      groups.get(section)!.push(note);
    }

    return html`<dialog ${ref(this.#allNotesDialogRef)}>
      <form method="dialog">
        <div id="dialog-header">
          <h2>All Comments (${allNotes.length})</h2>
          <button type="submit" aria-label="Close">
            <span class="g-icon filled round">close</span>
          </button>
        </div>
        <div id="dialog-body" style="padding: var(--bb-grid-size-4); display: flex; flex-direction: column; gap: var(--bb-grid-size-4);">
          ${Array.from(groups.entries()).map(([section, notes]) => {
            return html`<div class="section-group">
              <h3 style="font-size: 14px; font-weight: 600; color: var(--primary); margin: 0 0 var(--bb-grid-size-3) 0; border-bottom: 1px solid var(--border-color); padding-bottom: var(--bb-grid-size-2);">
                ${section}
              </h3>
              <div style="display: flex; flex-direction: column; gap: var(--bb-grid-size-2); padding: var(--bb-grid-size) var(--bb-grid-size-2); margin-bottom: var(--bb-grid-size-2);">
                ${notes.map((note) => {
                  const fieldRef = this.#getFieldReference(note.location);
                  return html`<div style="background: #fef08a; border: 1px solid #facc15; border-bottom-right-radius: 12px 4px; border-radius: 4px; padding: var(--bb-grid-size-3); font-size: 13px; color: #1e293b; box-shadow: 1px 3px 6px oklch(0 0 0 / 0.08), 0 1px 2px oklch(0 0 0 / 0.04); margin: 2px 4px 8px 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: var(--bb-grid-size-2); font-weight: 500; border-bottom: 1px dashed oklch(from #facc15 l c h / 0.5); padding-bottom: var(--bb-grid-size);">
                      <span style="font-weight: 600; color: #475569;">${fieldRef}</span>
                      <span>${new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--bb-grid-size-2);">
                      ${note.reaction ? html`<span 
                        class="g-icon round" 
                        style="color: ${note.reaction === 'good' ? '#34a853' : '#ea4335'}; font-size: 16px; flex-shrink: 0;"
                        title=${note.reaction === 'good' ? 'Marked as Good' : 'Marked as Bad'}
                      >${note.reaction === 'good' ? 'thumb_up' : 'thumb_down'}</span>` : nothing}
                      <div style="white-space: pre-wrap; line-height: 1.5;">${note.text}</div>
                    </div>
                  </div>`;
                })}
              </div>
            </div>`;
          })}
        </div>
      </form>
    </dialog>`;
  }


  render() {
    if (!this.#graphComponent) {
      return html`<div
        style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--light-dark-n-60);"
      >
        No BGL Topology Available
      </div>`;
    }

    const title = this.graph?.title || "Untitled Topology";
    const description = this.graph?.description || "";

    const judgement = ((this.rater as any)?.overall_judgement || ((this.rater as any)?.error ? 'FAIL' : 'UNKNOWN')) as string;
    const statusClass = judgement.toLowerCase();

    return html`
      <div id="bgl-header">
        <div style="max-width: calc(100% - 220px);">
          <h1>${title}</h1>
          ${description ? html`<p>${description}</p>` : nothing}
        </div>
        ${this.rater ? html`<div id="rater-indicator" style="pointer-events: auto;">
          <div class="status-row">
            <div class="status-dot ${statusClass}"></div>
            <span>Eval: ${judgement}</span>
          </div>
          ${(() => {
            const humanReactionNote = Array.isArray(this.notes)
              ? this.notes.find((n) => n.location.type === "rater" && n.location.fieldName === "overall_judgement" && n.reaction)
              : null;
            const humanReaction = humanReactionNote?.reaction;
            if (!humanReaction) return nothing;

            const isGood = humanReaction === "good";
            const color = isGood ? "#34a853" : "#ea4335";
            const text = isGood ? "Human Agrees" : "Marked AI Wrong";
            const icon = isGood ? "thumb_up" : "thumb_down";

            return html`<div style="display: flex; align-items: center; gap: var(--bb-grid-size-2); font-size: 11px; font-weight: 600; color: ${color}; margin-top: calc(-1 * var(--bb-grid-size)); margin-bottom: var(--bb-grid-size-2);">
              <span class="g-icon filled round" style="font-size: 14px; color: ${color};">${icon}</span>
              <span>${text}</span>
            </div>`;
          })()}
          <button @click=${() => this.#showRaterModal()}>Rating Details</button>
          <button 
            style="margin-top: var(--bb-grid-size); ${(this.notes || []).length > 0 ? '' : 'opacity: 0.5;'}" 
            @click=${() => this.#showAllNotesModal()}
          >All Comments (${(this.notes || []).length})</button>
        </div>` : nothing}
      </div>
      <div
        id="container"
        @click=${(evt: Event) => {
          const path = evt.composedPath();
          const graphNode = path.find(
            (el) => el instanceof HTMLElement && el.tagName === "BB-GRAPH-NODE"
          ) as any;

          if (graphNode) {
            const nodeId = graphNode.nodeId;
            const nodeDescriptor = this.graph?.nodes.find((n) => n.id === nodeId);
            if (nodeDescriptor) {
              this.#showModal(nodeDescriptor);
            }
          }
        }}
      >
        ${this.#graphComponent}
        ${this.transcript && this.transcript.length > 0 ? html`<bb-opie-avatar 
          style="position: absolute; left: var(--bb-grid-size-5); bottom: var(--bb-grid-size-5); z-index: 100;"
          @click=${() => this.#showTranscriptModal()}
        ></bb-opie-avatar>` : nothing}
      </div>
      ${this.#renderModal()}
      ${this.#renderRaterModal()}
      ${this.#renderTranscriptModal()}
      ${this.#renderAllNotesModal()}`;
  }
}
