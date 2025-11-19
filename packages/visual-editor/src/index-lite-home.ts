/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import "@breadboard-ai/shared-ui/lite/welcome-panel/project-listing.js";
import "@breadboard-ai/shared-ui/elements/overflow-menu/overflow-menu.js";
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
import type { BoardServer, Outcome, UUID } from "@breadboard-ai/types";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import type {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { err, ok } from "@breadboard-ai/utils";
import { SnackType } from "@breadboard-ai/shared-ui/types/types.js";
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";

const DELETE_BOARD_MESSAGE =
  "Are you sure you want to delete this gem? This cannot be undone";
const DELETING_BOARD_MESSAGE = "Deleting gem";
const REMIXING_BOARD_MESSAGE = "Duplicating gem";

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

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient;

  /**
   * Indicates whether we're currently remixing or deleting boards.
   */
  #busy = false;

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
    this.googleDriveClient = new GoogleDriveClient({
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
      this.googleDriveClient,
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

  #addGalleryResizeController(el: Element | undefined) {
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

  handleRoutedEvent(evt: Event) {
    const { payload } = evt as StateEvent<keyof StateEventDetailMap>;
    const { eventType } = payload;

    const report = (outcome: Outcome<void>) => {
      if (!ok(outcome)) {
        this.snackbar(outcome.$error, SnackType.ERROR);
      }
    };

    switch (eventType) {
      case "board.delete":
        return this.deleteBoard(payload.url).then(report);
      case "board.remix":
        return this.remixBoard(payload.url).then(report);
      case "board.togglepin":
        return this.togglePin(payload.url).then(report);
      case "board.load":
        return this.navigateTo(payload.url).then(report);
      default:
        console.warn("Unknown event type", eventType, payload);
        break;
    }
  }

  /**
   * Removes a URL from the recent boards list.
   * @param url -- url to remove
   */
  async removeRecentUrl(url: string) {
    // TODO: Implement this.
    console.log("Unimplemented: removing recent URL", url);
  }

  snackbar(message: string, type: SnackType): UUID {
    console.log(
      "Unimplemented: show this message in a snack bar",
      message,
      type
    );
    return crypto.randomUUID();
  }

  unsnackbar(id: UUID) {
    console.log("Unimplemented: hide snackbar with id", id);
  }

  async deleteBoard(url: string): Promise<Outcome<void>> {
    if (!this.boardServer) {
      return err(`Board server is undefined. Likely a misconfiguration`);
    }

    if (this.#busy) return;
    this.#busy = true;

    const snackbarId = this.snackbar(DELETING_BOARD_MESSAGE, SnackType.PENDING);
    try {
      if (!confirm(DELETE_BOARD_MESSAGE)) {
        return;
      }
      const result = await this.boardServer.delete(new URL(url));
      if (result.result) {
        return err(result.error || `Unable to delete "${url}"`);
      }
      this.removeRecentUrl(url);
    } finally {
      this.unsnackbar(snackbarId);
      this.#busy = false;
    }
  }

  async remixBoard(urlString: string) {
    if (this.#busy) return;
    this.#busy = true;

    if (!this.boardServer) {
      return err(`Board server is undefined. Likely a misconfiguration`);
    }
    const snackbarId = this.snackbar(REMIXING_BOARD_MESSAGE, SnackType.PENDING);
    try {
      const url = new URL(urlString);
      // 1. Load graph
      const graph = await this.boardServer.load(url);
      if (!graph) {
        return err(`Unable to load board "${url}"`);
      }
      // 2. Deep copy
      const remix = await this.boardServer.deepCopy(url, graph);
      // 3. Title as a remix
      remix.title = `${remix.title ?? "Untitled"} Remix`;
      // 4. Create new graph
      const { url: newUrlString } = await this.boardServer.create(url, remix);
      if (!newUrlString) {
        return err(`Unable to save remixed board "${url}"`);
      }
      // 5: Go to the new graph URL
      this.navigateTo(newUrlString);
    } finally {
      this.unsnackbar(snackbarId);
      this.#busy = false;
    }
  }

  async navigateTo(urlString: string) {
    console.log("Unimplemented: navigate to", urlString);
  }

  async togglePin(url: string) {
    console.log("TOGGLE PIN", url);
  }

  render() {
    return html`<bb-project-listing-lite
      ${ref((el) => this.#addGalleryResizeController(el))}
      .recentBoards=${[] /* TODO */}
      @bbevent=${this.handleRoutedEvent}
    ></bb-project-listing-lite>`;
  }
}
