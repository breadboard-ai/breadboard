/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BBLite from "./ui/lite/lite.js";
import "./ui/lite/welcome-panel/project-listing.js";
import "./ui/elements/overflow-menu/overflow-menu.js";
import { css, html, HTMLTemplateResult, LitElement } from "lit";
import { ref } from "lit/directives/ref.js";
import { customElement } from "lit/decorators.js";
import { MainArguments } from "./types/types.js";
import { EmbedHandler } from "./ui/embed/embed.js";
import { provide } from "@lit/context";
import { GlobalConfig, globalConfigContext } from "./ui/contexts/contexts.js";
import { boardServerContext } from "./ui/contexts/board-server.js";
import {
  GOOGLE_DRIVE_FILES_API_PREFIX,
  type Outcome,
  type UUID,
} from "@breadboard-ai/types";
import { SigninAdapter } from "./ui/utils/signin-adapter.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type {
  SnackbarActionEvent,
  StateEvent,
  StateEventDetailMap,
} from "./ui/events/events.js";
import { err, ok } from "@breadboard-ai/utils";
import { SnackbarMessage, SnackType } from "./ui/types/types.js";
import { googleDriveClientContext } from "./ui/contexts/google-drive-client-context.js";
import { RecentBoardStore } from "./data/recent-boards.js";
import { SignalWatcher } from "@lit-labs/signals";
import { GoogleDriveBoardServer } from "./board-server/server.js";

const DELETE_BOARD_MESSAGE =
  "Are you sure you want to delete this gem? This cannot be undone";
const DELETING_BOARD_MESSAGE = "Deleting gem";
const MIN_OFFSET_HEIGHT = 250;

@customElement("bb-lite-home")
export class LiteHome extends SignalWatcher(LitElement) {
  static styles = [
    BBLite.Styles.HostColorScheme.match,
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColorsMaterial.baseColors,
    BBLite.Styles.HostType.type,
    css`
      :host {
        display: block;
        background: var(--sys-color--body-background);
      }
    `,
  ];

  @provide({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig;

  @provide({ context: boardServerContext })
  accessor boardServer: GoogleDriveBoardServer | undefined;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient;

  /**
   * Indicates whether we're currently remixing or deleting boards.
   */
  #busy = false;

  /**
   * The snackbar machinery
   */
  accessor #snackbar: BBLite.Snackbar | undefined;
  #pendingSnackbarMessages: Array<{
    message: SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  /**
   * Recent boards machinery.
   */
  #recentBoardStore = RecentBoardStore.instance();

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
      mainArgs.initialSignInState
    );

    // Board server
    const proxyApiBaseUrl = new URL(
      "/api/drive-proxy/drive/v3/files",
      window.location.href
    ).href;
    const apiBaseUrl =
      signinAdapter.state === "signedout"
        ? proxyApiBaseUrl
        : GOOGLE_DRIVE_FILES_API_PREFIX;
    this.googleDriveClient = new GoogleDriveClient({
      apiBaseUrl,
      proxyApiBaseUrl,
      fetchWithCreds: opalShell.fetchWithCreds,
      isTestApi: !!mainArgs.guestConfiguration.isTestApi,
    });
    const googleDrivePublishPermissions =
      this.globalConfig.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [];
    const userFolderName =
      this.globalConfig.GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard";
    this.boardServer = new GoogleDriveBoardServer(
      // TODO: The first two args are not used but currently required
      "",
      signinAdapter,
      this.googleDriveClient,
      googleDrivePublishPermissions,
      userFolderName,
      opalShell.findUserOpalFolder,
      opalShell.listUserOpals
    );
    this.#recentBoardStore.restore();
  }

  connectedCallback() {
    super.connectedCallback();
    // TODO: remove (small convenience for development)
    if (new URLSearchParams(window.location.search).get("scroll") === "true") {
      this.style.overflow = "auto";
      this.style.padding = "24px";
    }
    this.#addResizeController();
  }

  #debounceResizeNotify = 0;
  #debounceResizeAnimate = true;
  #addResizeController() {
    // Here we debounce the call to notify the embedder because we may get a
    // flurry of updates. Instead we schedule the update and, when the timeout
    // expires, we issue the update.
    const notifyResize = (debounceTimeout = 0) => {
      // In some embedding contexts the height might be initially calculated as
      // being less than the gallery height. So we effectively use this check to
      // ignore such updates.
      if (this.offsetHeight < MIN_OFFSET_HEIGHT) return;

      clearTimeout(this.#debounceResizeNotify);
      this.#debounceResizeNotify = window.setTimeout(() => {
        this.#embedHandler?.sendToEmbedder({
          type: "resize",
          width: this.offsetWidth,
          height: this.offsetHeight,
          animate: this.#debounceResizeAnimate,
        });

        // After the first notification, we no longer animate.
        this.#debounceResizeAnimate = false;
      }, debounceTimeout);
    };
    const resizeObserver = new ResizeObserver(() => notifyResize());
    resizeObserver.observe(this);
    // Send initial notification.
    notifyResize(50);
  }

  handleRoutedEvent(evt: Event) {
    const { payload } = evt as StateEvent<keyof StateEventDetailMap>;
    const { eventType } = payload;

    const maybeReportError = (outcome: Outcome<void>) => {
      if (ok(outcome)) {
        return;
      }

      const snackbarId = crypto.randomUUID();
      this.snackbar(outcome.$error, SnackType.ERROR, snackbarId);
    };

    switch (eventType) {
      case "board.delete":
        return this.deleteBoard(payload.url).then(maybeReportError);
      case "board.remix":
        return this.remixBoard(payload.url).then(maybeReportError);
      case "board.togglepin":
        return this.togglePin(payload.url).then(maybeReportError);
      case "board.load":
        return this.loadBoard(payload.url).then(maybeReportError);
      case "board.create":
        return this.createBoard().then(maybeReportError);
      default:
        console.warn("Unknown event type", eventType, payload);
        break;
    }
  }

  /**
   * Removes a URL from the recent boards list.
   * @param url -- url to remove
   */
  async removeRecentBoard(url: string) {
    await this.#recentBoardStore.remove(url);
  }

  async addRecentBoard(url: string, title: string) {
    url = url.replace(window.location.origin, "");
    await this.#recentBoardStore.add({
      title,
      url,
    });
  }

  #renderSnackbar() {
    return html`<bb-snackbar
      ${ref((el: Element | undefined) => {
        if (!el) {
          this.#snackbar = undefined;
        }

        this.#snackbar = el as BBLite.Snackbar;
        for (const pendingMessage of this.#pendingSnackbarMessages) {
          const { message, id, type } = pendingMessage.message;
          if (message) {
            this.snackbar(message, type, id);
          }
        }

        this.#pendingSnackbarMessages.length = 0;
      })}
      @bbsnackbaraction=${async (evt: SnackbarActionEvent) => {
        evt.callback?.();
      }}
    ></bb-snackbar>`;
  }

  snackbar(message: string | HTMLTemplateResult, type: SnackType, id: UUID) {
    const replaceAll = true;
    const snackbarMessage: SnackbarMessage = {
      id,
      message,
      type,
      persistent: false,
      actions: [],
    };

    if (!this.#snackbar) {
      this.#pendingSnackbarMessages.push({
        message: snackbarMessage,
        replaceAll,
      });
      return;
    }

    return this.#snackbar.show(snackbarMessage, replaceAll);
  }

  unsnackbar(id: UUID) {
    this.#snackbar?.hide(id);
  }

  async deleteBoard(url: string): Promise<Outcome<void>> {
    if (!this.boardServer) {
      return err(`Board server is undefined. Likely a misconfiguration`);
    }

    if (this.#busy) return;
    this.#busy = true;

    const snackbarId = crypto.randomUUID();
    this.snackbar(DELETING_BOARD_MESSAGE, SnackType.PENDING, snackbarId);
    try {
      if (!confirm(DELETE_BOARD_MESSAGE)) {
        return;
      }
      const result = await this.boardServer.delete(new URL(url));
      if (!result.result) {
        return err(result.error || `Unable to delete "${url}"`);
      }
      this.removeRecentBoard(url);
    } finally {
      this.unsnackbar(snackbarId);
      this.#busy = false;
    }
  }

  async remixBoard(urlString: string) {
    this.#embedHandler?.sendToEmbedder({
      type: "remix_board",
      boardId: urlString,
    });
  }

  async loadBoard(urlString: string) {
    this.#embedHandler?.sendToEmbedder({
      type: "load_board",
      boardId: urlString,
    });
  }

  async createBoard() {
    this.#embedHandler?.sendToEmbedder({
      type: "create_board",
    });
  }

  async togglePin(url: string) {
    url = url.replace(window.location.origin, "");
    const board = this.#recentBoardStore.boards.find((b) => b.url === url);
    if (board) {
      await this.#recentBoardStore.setPin(url, !board.pinned);
    }
  }

  render() {
    return html`<section id="home">
      <bb-project-listing-lite
        .recentBoards=${this.#recentBoardStore.boards}
        @bbevent=${this.handleRoutedEvent}
      ></bb-project-listing-lite>
      ${this.#renderSnackbar()}
    </section>`;
  }
}
