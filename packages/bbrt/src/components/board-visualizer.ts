/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GraphDescriptor,
  type InspectableNodePorts,
  type NodeHandlerMetadata,
  inspect,
} from "@google-labs/breadboard";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MAIN_BOARD_ID } from "../../../shared-ui/dist/constants/constants.js";
import { TopGraphObserver } from "../../../shared-ui/dist/utils/utils.js";
import { loadSharedUi } from "../util/load-shared-ui.js";

@customElement("bbrt-board-visualizer")
export class BBRTBoardVisualizer extends LitElement {
  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined = undefined;

  static override styles = css`
    :host {
      display: flex;
    }
    bb-graph-renderer {
      width: 100%;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    loadSharedUi().then(() => this.requestUpdate());
  }

  override render() {
    const graph = this.graph;
    if (graph === undefined) {
      return nothing;
    }
    return html`<bb-graph-renderer
      .configs=${new Map([[MAIN_BOARD_ID, this.#config(graph)]])}
      .topGraphUrl=${graph.url ?? "no-url"}
      .topGraphResult=${TopGraphObserver.entryResult(graph)}
      .assetPrefix=${""}
      .invertZoomScrollDirection=${false}
      .readOnly=${false}
      .highlightInvalidWires=${false}
      .showPortTooltips=${false}
      .showSubgraphsInline=${false}
      .selectionChangeId=${""}
    ></bb-graph-renderer>`;
  }

  #config(graph: GraphDescriptor): unknown {
    const inspectable = inspect(graph);
    const ports = new Map<string, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
    for (const node of inspectable.nodes()) {
      ports.set(node.descriptor.id, node.currentPorts());
      try {
        typeMetadata.set(node.descriptor.type, node.type().currentMetadata());
      } catch {
        // TODO(aomarks) In the visual editor, we emit an event that suggests
        // removing this node from the graph.
      }
    }
    return {
      url: graph.url ?? "no-url",
      title: graph.title ?? "Untitled",
      subGraphId: null,
      minimized: false,
      showNodePreviewValues: true,
      showGraphOutline: false,
      collapseNodesByDefault: false,
      ports: ports,
      typeMetadata,
      edges: inspectable.edges(),
      nodes: inspectable.nodes(),
      modules: inspectable.modules(),
      metadata: inspectable.metadata() ?? {},
      selectionState: null,
      references: null,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-board-visualizer": BBRTBoardVisualizer;
  }
}
