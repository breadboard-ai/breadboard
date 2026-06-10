/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import {
  Template,
  NOTEBOOKLM_MIMETYPE,
  toNotebookLmUrl,
} from "@breadboard-ai/utils";
import type {
  GraphAsset,
  GraphAssetDescriptor,
} from "../../../../sca/types.js";
import * as Styles from "../../../styles/styles.js";
import { extractPromptText } from "../../../../utils/prompt-utils.js";
import "../../input/add-asset/add-asset-button.js";
import "../../input/add-asset/add-asset-modal.js";
import "./asset-thumbnail.js";
import {
  AddAssetEvent,
  AddAssetRequestEvent,
  ShowTooltipEvent,
  HideTooltipEvent,
} from "../../../events/events.js";
import type { AssetMetadata } from "@breadboard-ai/types";

@customElement("bb-agent-asset-shelf")
export class AgentAssetShelf extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @state()
  private accessor _showAddAssetModal = false;

  @state()
  private accessor _addAssetType: string | null = null;

  @state()
  private accessor _allowedMimeTypes: string | null = null;

  @state()
  private accessor _editingAsset: GraphAsset | null = null;

  @state()
  private accessor _playingAudioPath: string | null = null;

  @state()
  private accessor _pendingAssets: Array<{
    id: string;
    title: string;
    badgeLabel: string;
  }> = [];

  private _activeAudio: HTMLAudioElement | null = null;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        background: transparent;
      }

      .asset-shelf-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        background: transparent;
      }

      .section-header {
        display: flex;
        align-items: center;
        margin-bottom: var(--bb-grid-size-7);
        user-select: none;

        & h2 {
          margin: 0;
          flex: 1;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-20);
        }

        & bb-add-asset-button {
          --background-color: var(--sys-color--primary);
          --text-color: var(--sys-color--on-primary);
          --background-hover-color: var(--sys-color--primary);
          --text-hover-color: var(--sys-color--on-primary);
          --button-border: none;
          transition: opacity 0.15s ease;

          &:hover {
            opacity: 0.9;
          }
        }
      }

      .assets-list {
        display: flex;
        flex-direction: column;
        padding: var(--bb-grid-size) 0;
      }

      .asset-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-2) 0;
        position: relative;
      }

      .asset-row.pending {
        opacity: 0.6;
        pointer-events: none;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .spinning {
        animation: spin 1s linear infinite;
        display: inline-block;
      }

      .drag-handle {
        cursor: grab;
        color: var(--light-dark-n-60);
        user-select: none;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 40px;
        margin-left: -20px;
        margin-right: 4px;
        opacity: 0;
        transition:
          opacity 0.15s ease,
          color 0.15s ease;

        &:hover {
          color: var(--light-dark-n-10);
        }

        &:active {
          cursor: grabbing;
        }
      }

      .asset-row:hover .drag-handle {
        opacity: 1;
      }

      .asset-info-wrapper {
        display: flex;
        align-items: center;
        min-width: 0;
        flex: 1;
        cursor: pointer;
        border-radius: var(--bb-grid-size-2);
        transition: background-color 0.15s ease;
        padding: var(--bb-grid-size);
        margin-left: calc(-1 * var(--bb-grid-size));

        &:hover {
          background: var(--light-dark-n-98);
        }
      }

      .asset-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--bb-grid-size-2);
        background: var(--ui-asset-secondary, var(--light-dark-n-95));
        margin-right: var(--bb-grid-size-5);
        flex-shrink: 0;
        outline: 1px solid var(--light-dark-n-90);
        overflow: hidden;

        & .g-icon {
          font-size: 20px;
          color: var(--light-dark-n-10, var(--n-10));
        }
      }

      .asset-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
        padding-right: var(--bb-grid-size-4);
      }

      .asset-title {
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        color: light-dark(var(--n-10), var(--n-90));
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .asset-meta {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
      }

      .asset-badge {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--light-dark-n-40);
        background: var(--light-dark-n-95);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid var(--light-dark-n-90);
        letter-spacing: 0.5px;
      }

      .in-use-pill {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: light-dark(#137333, #81c995);
        background: light-dark(#e6f4ea, #1c3d27);
        padding: 2px 8px;
        border-radius: 10px;
        letter-spacing: 0.5px;
      }

      .remove-button {
        background: transparent;
        border: none;
        color: var(--light-dark-n-40);
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
        flex-shrink: 0;

        &:hover {
          background: light-dark(var(--n-90), var(--n-30));
          color: var(--light-dark-n-10);
        }

        & .g-icon {
          font-size: 18px;
        }
      }

      .empty-state {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-4) var(--bb-grid-size-3);
        background: light-dark(rgba(0, 0, 0, 0.02), rgba(255, 255, 255, 0.02));
        border-radius: var(--bb-grid-size-2);
        color: var(--light-dark-n-40);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        user-select: none;

        & .g-icon {
          font-size: 20px;
          color: var(--light-dark-n-50);
          flex-shrink: 0;
        }

        & p {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;

          & span {
            color: var(--light-dark-n-20);
            font-weight: 500;
          }
        }
      }
    `,
  ];

  #onDragStart(evt: DragEvent, asset: GraphAsset) {
    if (!evt.dataTransfer) return;

    const mimeType = asset.metadata?.subType || "application/octet-stream";
    const title = asset.metadata?.title || "Asset";

    evt.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "asset",
        path: asset.path,
        title,
        mimeType,
      })
    );
    evt.dataTransfer.effectAllowed = "copy";
  }

  #onRemoveAsset(path: string) {
    this.sca.actions.asset.removeGraphAsset(path);
  }

  #onEditAsset(asset: GraphAsset) {
    const type = this.#getAssetType(asset);
    if (!type) return;

    this._showAddAssetModal = true;
    this._editingAsset = asset;
    this._addAssetType = type;
    this.requestUpdate();
  }

  #getAssetType(asset: GraphAsset): string | null {
    if (asset.metadata?.subType === "notebooklm") {
      return "notebooklm";
    }

    const firstPart = asset.data[0]?.parts[0];
    if (!firstPart) return "upload";

    if ("fileData" in firstPart && firstPart.fileData) {
      const uri = firstPart.fileData.fileUri;
      if (uri.includes("youtube.com") || uri.includes("youtu.be")) {
        return "youtube";
      }
      return "upload";
    }

    if ("storedData" in firstPart && firstPart.storedData) {
      if (firstPart.storedData.mimeType === NOTEBOOKLM_MIMETYPE) {
        return "notebooklm";
      }
      if (firstPart.storedData.handle.startsWith("drive:/")) {
        return "gdrive";
      }
      return "upload";
    }

    if ("inlineData" in firstPart && firstPart.inlineData) {
      if (asset.metadata?.title === "Drawing") {
        return "drawable";
      }
      if (asset.metadata?.title === "Webcam Video") {
        return "webcam-video";
      }
      return "upload";
    }

    return "upload";
  }

  #onToggleAudio(asset: GraphAsset) {
    if (this._playingAudioPath === asset.path) {
      if (this._activeAudio) {
        this._activeAudio.pause();
      }
      this._playingAudioPath = null;
    } else {
      if (this._activeAudio) {
        this._activeAudio.pause();
      }

      const firstPart = asset.data[0]?.parts[0];
      if (firstPart && "inlineData" in firstPart && firstPart.inlineData) {
        const dataUrl = `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
        this._activeAudio = new Audio(dataUrl);
        this._activeAudio.play();
        this._playingAudioPath = asset.path;

        this._activeAudio.onended = () => {
          this._playingAudioPath = null;
          this.requestUpdate();
        };
      }
    }
    this.requestUpdate();
  }

  #inferMimeType(asset: GraphAsset): string | undefined {
    if (asset.metadata?.subType) {
      return asset.metadata.subType;
    }

    const firstPart = asset.data[0]?.parts[0];
    if (firstPart) {
      if ("storedData" in firstPart && firstPart.storedData?.mimeType) {
        return firstPart.storedData.mimeType;
      }
      if ("inlineData" in firstPart && firstPart.inlineData?.mimeType) {
        return firstPart.inlineData.mimeType;
      }
      if ("fileData" in firstPart && firstPart.fileData?.mimeType) {
        return firstPart.fileData.mimeType;
      }
    }

    const path = asset.path.toLowerCase();
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".gif")) return "image/gif";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".svg")) return "image/svg+xml";

    if (path.endsWith(".mp3")) return "audio/mp3";
    if (path.endsWith(".wav")) return "audio/wav";
    if (path.endsWith(".m4a")) return "audio/m4a";
    if (path.endsWith(".ogg")) return "audio/ogg";

    if (path.endsWith(".mp4")) return "video/mp4";
    if (path.endsWith(".webm")) return "video/webm";
    if (path.endsWith(".mov")) return "video/quicktime";

    if (path.endsWith(".pdf")) return "application/pdf";

    if (path.endsWith(".txt")) return "text/plain";
    if (path.endsWith(".json")) return "application/json";
    if (path.endsWith(".csv")) return "text/csv";
    if (path.endsWith(".md")) return "text/markdown";

    return undefined;
  }

  #getAssetBadgeLabel(mimeType?: string): string {
    if (!mimeType) return "FILE";
    if (mimeType.startsWith("image/")) return "IMAGE";
    if (mimeType.startsWith("audio/")) return "AUDIO";
    if (mimeType.startsWith("video/")) return "VIDEO";
    if (mimeType === "application/pdf") return "PDF";
    if (mimeType.startsWith("text/")) return "TEXT";
    if (mimeType === "application/x-notebooklm") return "NOTEBOOK";
    const parts = mimeType.split("/");
    return parts[parts.length - 1].toUpperCase();
  }

  render() {
    const graphController = this.sca?.controller?.editor?.graph;
    if (!graphController) return nothing;

    // Subscribe to graph version changes
    void graphController.version;

    const graph = graphController.graph;
    const agentNode = graph.nodes?.find(
      (n) => n.configuration?.["generation-mode"] === "agent"
    );
    if (!agentNode) return nothing;

    const config = agentNode.configuration ?? {};
    const promptText = extractPromptText(config["config$prompt"]);

    // Find referenced asset placeholders in the prompt
    const template = new Template(promptText);
    const referencedAssetPaths = new Set(
      template.placeholders.filter((p) => p.type === "asset").map((p) => p.path)
    );

    // Gather all assets from the graph store and referenced paths
    const allAssetsMap = new Map<string, GraphAsset>(
      graphController.graphAssets
    );

    for (const path of referencedAssetPaths) {
      if (!allAssetsMap.has(path)) {
        allAssetsMap.set(path, {
          path,
          data: [],
          metadata: {
            title: path.split("/").pop() || "Asset",
            type: "file",
          },
        });
      }
    }

    const allAssets = Array.from(allAssetsMap.values());

    // Sort: Alphabetically by title
    allAssets.sort((a, b) => {
      const aTitle = a.metadata?.title || a.path;
      const bTitle = b.metadata?.title || b.path;
      return aTitle.localeCompare(bTitle);
    });

    return html`
      <div class="asset-shelf-wrapper">
        <div class="section-header">
          <h2>Assets</h2>
          ${graphController.readOnly
            ? nothing
            : html`<bb-add-asset-button
                .showGDrive=${true}
                .showNotebookLm=${!!this.sca.env.flags.get("enableNotebookLm")}
                .label=${"Add asset"}
                @bbaddassetrequest=${(evt: AddAssetRequestEvent) => {
                  if (evt.assetType === "notebooklm") {
                    this.sca.actions.notebookLmPicker.open(
                      async (notebooks) => {
                        const newPending = notebooks.map((notebook) => ({
                          id: globalThis.crypto.randomUUID(),
                          title:
                            notebook.preview || notebook.name || "Notebook",
                          badgeLabel: "NOTEBOOK",
                        }));
                        this._pendingAssets = [
                          ...this._pendingAssets,
                          ...newPending,
                        ];
                        this.requestUpdate();

                        for (let i = 0; i < notebooks.length; i++) {
                          const notebook = notebooks[i];
                          const pendingItem = newPending[i];
                          const descriptor: GraphAssetDescriptor = {
                            metadata: {
                              title: pendingItem.title,
                              type: "content",
                              subType: "notebooklm",
                            },
                            path: `asset-${globalThis.crypto.randomUUID().slice(0, 8)}.webp`,
                            data: [
                              {
                                role: "user",
                                parts: [
                                  {
                                    storedData: {
                                      handle: toNotebookLmUrl(notebook.id),
                                      mimeType: NOTEBOOKLM_MIMETYPE,
                                    },
                                  },
                                ],
                              },
                            ],
                          };
                          await this.sca.actions.asset.addGraphAsset(
                            descriptor
                          );
                          this._pendingAssets = this._pendingAssets.filter(
                            (a) => a.id !== pendingItem.id
                          );
                          this.requestUpdate();
                        }
                      }
                    );
                    return;
                  }
                  this._showAddAssetModal = true;
                  this._addAssetType = evt.assetType;
                  this._allowedMimeTypes = evt.allowedMimeTypes;
                  this.requestUpdate();
                }}
              ></bb-add-asset-button>`}
        </div>
        <div class="assets-list">
          ${allAssets.length > 0 || this._pendingAssets.length > 0
            ? html`
                ${this._pendingAssets.map(
                  (pending) => html`
                    <div class="asset-row pending" .key=${pending.id}>
                      <div class="asset-info-wrapper">
                        <div class="asset-icon-container">
                          <span class="g-icon spinning">sync</span>
                        </div>
                        <div class="asset-details">
                          <div class="asset-title">${pending.title}</div>
                          <div class="asset-meta">
                            <span class="asset-badge"
                              >${pending.badgeLabel}</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                )}
                ${allAssets.map((asset) => {
                  const mimeType = this.#inferMimeType(asset);
                  const badgeLabel = this.#getAssetBadgeLabel(mimeType);
                  const isInUse = referencedAssetPaths.has(asset.path);
                  const isPlaying = this._playingAudioPath === asset.path;

                  return keyed(
                    asset.path,
                    html`
                      <div class="asset-row">
                        ${graphController.readOnly
                          ? nothing
                          : html`<span
                              class="drag-handle g-icon"
                              draggable="true"
                              @dragstart=${(evt: DragEvent) =>
                                this.#onDragStart(evt, asset)}
                              @pointerover=${(evt: PointerEvent) => {
                                this.dispatchEvent(
                                  new ShowTooltipEvent(
                                    "Drag to add to agent instructions",
                                    evt.clientX,
                                    evt.clientY
                                  )
                                );
                              }}
                              @pointerout=${() => {
                                this.dispatchEvent(new HideTooltipEvent());
                              }}
                              >drag_indicator</span
                            >`}
                        <div
                          class="asset-info-wrapper"
                          @click=${() => this.#onEditAsset(asset)}
                        >
                          <div class="asset-icon-container">
                            <bb-asset-thumbnail
                              .asset=${asset}
                              .mimeType=${mimeType || ""}
                              .playing=${isPlaying}
                              @bb-audio-toggle=${() =>
                                this.#onToggleAudio(asset)}
                            ></bb-asset-thumbnail>
                          </div>
                          <div class="asset-details">
                            <div class="asset-title">
                              ${asset.metadata?.title || asset.path}
                            </div>
                            <div class="asset-meta">
                              <span class="asset-badge">${badgeLabel}</span>
                              ${isInUse
                                ? html`<span class="in-use-pill">In use</span>`
                                : nothing}
                            </div>
                          </div>
                        </div>
                        ${graphController.readOnly
                          ? nothing
                          : html`<button
                              class="remove-button"
                              @click=${() => this.#onRemoveAsset(asset.path)}
                              @pointerover=${(evt: PointerEvent) => {
                                this.dispatchEvent(
                                  new ShowTooltipEvent(
                                    "Remove asset",
                                    evt.clientX,
                                    evt.clientY
                                  )
                                );
                              }}
                              @pointerout=${() => {
                                this.dispatchEvent(new HideTooltipEvent());
                              }}
                            >
                              <span class="g-icon">close</span>
                            </button>`}
                      </div>
                    `
                  );
                })}
              `
            : html`
                <div class="empty-state">
                  <span class="g-icon filled heavy">attach_file_off</span>
                  <p>
                    ${graphController.readOnly
                      ? html`This agent has no assets.`
                      : html`<span>No assets yet.</span> Click "Add asset" to
                          upload images, audio, or PDFs.`}
                  </p>
                </div>
              `}
        </div>
      </div>

      ${this._showAddAssetModal
        ? html`<bb-add-asset-modal
            .assetType=${this._addAssetType}
            .allowedMimeTypes=${this._allowedMimeTypes}
            .editingAsset=${this._editingAsset}
            @bboverlaydismissed=${() => {
              this._showAddAssetModal = false;
              this._addAssetType = null;
              this._allowedMimeTypes = null;
              this._editingAsset = null;
              this.requestUpdate();
            }}
            @bbaddasset=${async (evt: AddAssetEvent) => {
              this._showAddAssetModal = false;
              this._addAssetType = null;
              this._allowedMimeTypes = null;

              const content = evt.asset;
              const metadata = evt.metadata;

              if (this._editingAsset) {
                const path = this._editingAsset.path;
                this._editingAsset = null;
                const result = await this.sca.actions.asset.update(
                  path,
                  metadata?.title || "Asset",
                  [content]
                );
                if (result && "$error" in result) {
                  console.error(result.$error);
                }
                this.requestUpdate();
                return;
              }

              // Generate a unique path using the extension inferred from metadata
              const inferAssetExtension = (meta?: AssetMetadata): string => {
                if (meta?.subType) {
                  const parts = meta.subType.split("/");
                  return parts[parts.length - 1];
                }
                if (meta?.title && meta.title.includes(".")) {
                  return (
                    meta.title.split(".").pop()?.toLowerCase() ?? "Untitled"
                  );
                }
                return "bin";
              };

              const ext = inferAssetExtension(metadata);
              const path = `asset-${globalThis.crypto.randomUUID().slice(0, 8)}.${ext}`;

              const assetDescriptor: GraphAssetDescriptor = {
                metadata,
                path,
                data: [content],
              };

              const tempId = globalThis.crypto.randomUUID();
              const title = metadata?.title || "Asset";
              const mimeType = this.#inferMimeType({
                path,
                data: [content],
                metadata,
              });
              const badgeLabel = this.#getAssetBadgeLabel(mimeType);

              this._pendingAssets = [
                ...this._pendingAssets,
                { id: tempId, title, badgeLabel },
              ];
              this.requestUpdate();

              await this.sca.actions.asset.addGraphAsset(assetDescriptor);

              this._pendingAssets = this._pendingAssets.filter(
                (a) => a.id !== tempId
              );
              this.requestUpdate();
            }}
          ></bb-add-asset-modal>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-agent-asset-shelf": AgentAssetShelf;
  }
}
