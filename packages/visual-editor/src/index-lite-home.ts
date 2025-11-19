/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import "@breadboard-ai/shared-ui/lite/welcome-panel/project-listing.js";
import { html, LitElement } from "lit";
import { ref } from "lit/directives/ref.js";
import { customElement } from "lit/decorators.js";
import { MainArguments } from "./types/types";
import { EmbedHandler } from "@breadboard-ai/shared-ui/embed/embed.js";
import { provide } from "@lit/context";
import {
  GlobalConfig,
  globalConfigContext,
} from "@breadboard-ai/shared-ui/contexts";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import type { BoardServer } from "@breadboard-ai/types";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

@customElement("bb-lite-home")
export class LiteHome extends LitElement {
  static styles = [
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColors.baseColors,
    BBLite.Styles.HostType.type,
  ];
  
  @provide({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig;
  
  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer | undefined;
  
  readonly #embedHandler?: EmbedHandler;
  constructor(mainArgs: MainArguments) {
    super();
    // Static deployment config
    this.globalConfig = mainArgs.globalConfig;
    
    // Communication with embedder
    this.#embedHandler = mainArgs.embedHandler;

    // Authentication
    const opalShell = mainArgs.shellHost;
    const signinAdapter = new SigninAdapter(
      opalShell,
      mainArgs.initialSignInState,
      () => {
        throw new Error("Expected scopes to be granted");
      }
    );

    // Board server
    const proxyApiBaseUrl = new URL("/api/drive-proxy/", window.location.href)
      .href;
    const apiBaseUrl =
      signinAdapter.state === "signedout"
        ? proxyApiBaseUrl
        : this.globalConfig.GOOGLE_DRIVE_API_ENDPOINT ||
          "https://www.googleapis.com";
    const googleDriveClient = new GoogleDriveClient({
      apiBaseUrl,
      proxyApiBaseUrl,
      fetchWithCreds: opalShell.fetchWithCreds,
    });
    const googleDrivePublishPermissions =
      this.globalConfig.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [];
    const userFolderName =
      this.globalConfig.GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard";
    GoogleDriveBoardServer.from(
      // TODO: The first two args are not used but currently required
      "",
      {
        username: "",
        apiKey: "",
        secrets: new Map(),
      },
      signinAdapter,
      googleDriveClient,
      googleDrivePublishPermissions,
      userFolderName,
      this.globalConfig.BACKEND_API_ENDPOINT ?? ""
    ).then((boardServer) => {
      this.boardServer = boardServer;
    });
  }

  connectedCallback() {
    super.connectedCallback();
    // TODO: remove (small convenience for development)
    if (new URLSearchParams(window.location.search).get("scroll") === "true") {
      this.style.overflow = "auto";
      this.style.padding = "24px";
    }
  }


  #addGGalleryResizeController(el: Element | undefined) {
    if (el instanceof HTMLElement) {
      const notifyResize = () => {
        this.#embedHandler?.sendToEmbedder({
          type: "resize",
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
      };
      const resizeObserver = new ResizeObserver(notifyResize);
      resizeObserver.observe(el);
      // Send initial notification
      notifyResize();
    }
  }

  render() {
    return html`<bb-project-listing-lite
      ${ref((el) => this.#addGGalleryResizeController(el))}
      .recentBoards=${[] /* TODO */}
    ></bb-project-listing-lite>`;
  }
}
