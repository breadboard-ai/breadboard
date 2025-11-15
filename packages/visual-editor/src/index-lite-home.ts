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

  constructor(mainArgs: MainArguments) {
    super();
    // Static deployment config
    this.globalConfig = mainArgs.globalConfig;
    this.#embedHandler = mainArgs.embedHandler;
  }

  readonly #embedHandler?: EmbedHandler;

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
