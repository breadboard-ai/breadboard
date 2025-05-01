/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FileDataPart } from "@breadboard-ai/types";
import { type GraphDescriptor, type LLMContent } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { css, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { loadDriveShare } from "./google-apis.js";

// Silly dynamic type expression because "gapi.drive.share.ShareClient" doesn't
// resolve for some reason, even though it's declared in a namespace statement
// in "./google-apis.js".
type ShareClient = InstanceType<
  Awaited<ReturnType<typeof loadDriveShare>>["ShareClient"]
>;

// We want only one ShareClient to ever exist globally, and only one user of it
// at a time, because it is stateful. Each instance of ShareClient dumps a bunch
// of DOM into the body the first time the share dialog is opened, but never
// cleans it up, and we don't want this to accumulate.
let globalShareClient: ShareClient | undefined = undefined;
let globalShareClientLocked = false;

@customElement("bb-google-drive-share-panel")
export class GoogleDriveSharePanel extends LitElement {
  static styles = [
    css`
      :host {
        display: none;
      }
    `,
  ];

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined;

  #status: "closed" | "opening" | "open" = "closed";

  override render() {
    return nothing;
  }

  async open() {
    if (this.#status !== "closed") {
      return;
    }
    const graph = this.graph;
    if (!graph) {
      console.error("No graph");
      return;
    }
    const url = graph.url ? new URL(graph.url) : null;
    if (url?.protocol !== "drive:") {
      console.error(`Expected "drive:" URL, got: ${graph?.url}`);
      return;
    }
    if (globalShareClientLocked) {
      console.error("Global ShareClient was locked");
      return;
    }
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got: ${auth?.state}`);
      return;
    }

    this.#status = "opening";
    globalShareClientLocked = true;
    if (!globalShareClient) {
      const shareLib = await loadDriveShare();
      globalShareClient = new shareLib.ShareClient();
    }

    const graphFileId = url.pathname.replace(/^\/+/, "");
    const assetFileIds = findGoogleDriveAssetsInGraph(graph);
    globalShareClient.setItemIds([graphFileId, ...assetFileIds]);
    globalShareClient.setOAuthToken(auth.grant.access_token);

    // Weirdly, there is no API for getting the dialog element, or for finding
    // out when the user closes it. Upon opening, a bunch of DOM gets added to
    // document.body. Upon closing, that DOM stays there forever, but becomes
    // hidden. So, as a hack, we can use a MutationObserver to notice these
    // things happening.
    const observer = new MutationObserver(() => {
      const dialog = document.body.querySelector(
        `[guidedhelpid="drive_share_dialog"]`
      );
      if (dialog) {
        const ariaHidden = dialog.getAttribute("aria-hidden");
        if (this.#status === "opening" && ariaHidden !== "true") {
          this.#status = "open";
        } else if (this.#status === "open" && ariaHidden === "true") {
          this.#status = "closed";
          globalShareClientLocked = false;
          observer.disconnect();
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
    });

    globalShareClient.showSettingsDialog();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-share-panel": GoogleDriveSharePanel;
  }
}

function findGoogleDriveAssetsInGraph(graph: GraphDescriptor): string[] {
  // Use a set because there can be duplicates.
  const fileIds = new Set<string>();
  for (const asset of Object.values(graph?.assets ?? {})) {
    if (asset.metadata?.subType === "gdrive") {
      // Cast needed because `data` is very broadly typed as `NodeValue`.
      const firstPart = (asset.data as LLMContent[])[0]?.parts[0];
      if (firstPart && "fileData" in firstPart) {
        const fileId = firstPart.fileData?.fileUri;
        if (fileId) {
          fileIds.add(fileId);
        }
      }
    }
  }
  return [...fileIds];
}
