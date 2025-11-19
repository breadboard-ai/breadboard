/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import "@breadboard-ai/shared-ui/lite/welcome-panel/project-listing.js";
import "@breadboard-ai/shared-ui/elements/overflow-menu/overflow-menu.js";
import { html, HTMLTemplateResult, LitElement } from "lit";
import { ref } from "lit/directives/ref.js";
import { customElement, state } from "lit/decorators.js";
import { MainArguments } from "./types/types";
import { EmbedHandler } from "@breadboard-ai/shared-ui/embed/embed.js";
import { provide } from "@lit/context";
import {
  GlobalConfig,
  globalConfigContext,
} from "@breadboard-ai/shared-ui/contexts";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import type { Outcome, UUID } from "@breadboard-ai/types";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import type {
  SnackbarActionEvent,
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { err, ok } from "@breadboard-ai/utils";
import {
  RecentBoard,
  SnackbarMessage,
  SnackType,
} from "@breadboard-ai/shared-ui/types/types.js";
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";
import { RecentBoardStore } from "./data/recent-boards";

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

  @state()
  accessor recentBoards: RecentBoard[] = [];

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
    this.#recentBoardStore
      .restore()
      .then((recentBoards) => (this.recentBoards = recentBoards));
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
        const snackbarId = crypto.randomUUID();
        this.snackbar(outcome.$error, SnackType.ERROR, snackbarId);
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
  async removeRecentBoard(url: string) {
    const count = this.recentBoards.length;

    const removeIndex = this.recentBoards.findIndex(
      (board) => board.url === url
    );
    if (removeIndex !== -1) {
      this.recentBoards.splice(removeIndex, 1);
    }

    if (count === this.recentBoards.length) {
      return;
    }

    await this.#recentBoardStore.store(this.recentBoards);
  }

  async addRecentBoard(url: string, title: string) {
    url = url.replace(window.location.origin, "");
    const currentIndex = this.recentBoards.findIndex(
      (board) => board.url === url
    );
    if (currentIndex === -1) {
      this.recentBoards.unshift({
        title,
        url,
      });
    } else {
      const [item] = this.recentBoards.splice(currentIndex, 1);
      if (title) {
        item.title = title;
      }
      this.recentBoards.unshift(item);
    }

    if (this.recentBoards.length > 50) {
      this.recentBoards.length = 50;
    }

    await this.#recentBoardStore.store(this.recentBoards);
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
    if (this.#busy) return;
    this.#busy = true;

    if (!this.boardServer) {
      return err(`Board server is undefined. Likely a misconfiguration`);
    }
    const snackbarId = crypto.randomUUID();
    this.snackbar(REMIXING_BOARD_MESSAGE, SnackType.PENDING, snackbarId);
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
      await Promise.all([
        this.boardServer.flushSaveQueue(newUrlString),
        this.addRecentBoard(newUrlString, remix.title),
      ]);
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
    url = url.replace(window.location.origin, "");
    const boardToUpdate = this.recentBoards.find((board) => board.url === url);
    if (!boardToUpdate) {
      console.log(`Unable to find board ${url}`);
      return;
    }
    boardToUpdate.pinned = !boardToUpdate.pinned;

    await this.#recentBoardStore.store(this.recentBoards);
  }

  render() {
    return html`<section id="home">
      <bb-project-listing-lite
        ${ref((el) => this.#addGalleryResizeController(el))}
        .recentBoards=${this.recentBoards}
        @bbevent=${this.handleRoutedEvent}
      ></bb-project-listing-lite>
      ${this.#renderSnackbar()}
    </section>`;
  }
}
