/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils.js";
import { GRAPH_OPERATIONS } from "./types.js";
import MarkdownIt from "markdown-it";

const markdown = MarkdownIt();
const backgroundColor = getGlobalColor("--bb-ui-50");
const emptyTextColor = getGlobalColor("--bb-neutral-600");
const textColor = getGlobalColor("--bb-neutral-800");
const linkColor = getGlobalColor("--bb-ui-400");
const defaultBorderColor = getGlobalColor("--bb-neutral-500");
const selectedBorderColor = getGlobalColor("--bb-ui-600");

/**
 * This class acts a link proxy. Under the hood Pixi.js uses a Foreign Object in
 * SVG to do the rendering for an HTMLText instance. We replicate that here so
 * that when a user clicks on a comment we can interrogate the proxy to see if
 * the click would have landed on an anchor.
 *
 * To implement this we create an iframe clipped to 0, 0, 0, 0 so it renders
 * but does not appear within the viewport. This iframe contains the SVG with
 * the same styles that Pixi used. When we get a click we call the iframe's
 * elementFromPoint with the local x & y coordinates, which should match the
 * iframe's relative coordinates for the SVG.
 */
class GraphCommentProxy {
  #src: string | null = null;
  #linkProxy: HTMLIFrameElement | null = null;

  constructor(padding = 12, width = 500, html: string, styles: string) {
    const height = width * 4;

    this.#linkProxy = document.createElement("iframe");
    this.#linkProxy.setAttribute("seamless", "seamless");
    this.#linkProxy.style["position"] = "fixed";
    this.#linkProxy.style["top"] = "0";
    this.#linkProxy.style["left"] = "0";
    this.#linkProxy.style["zIndex"] = "10000";
    this.#linkProxy.style["clipPath"] = "rect(0 0 0 0)";
    document.body.appendChild(this.#linkProxy);

    const proxyDoc = this.#linkProxy.contentDocument;
    if (!proxyDoc) {
      console.warn("Unable to access link proxy - no content document");
      return;
    }

    this.#src = URL.createObjectURL(
      new Blob(
        [
          `<style> html, body { margin: 0; padding: 0 }</style>
          <svg width="${width}" viewBox="0 0 ${width} ${height}">
            <style>
              ${styles}

              div {
                padding: ${padding}px;
              }
            </style>
            <foreignObject width="${width}" height="${height}">
              <div>${html}</div>
            </foreignObject>
          </svg>`,
        ],
        { type: "text/html" }
      )
    );

    this.#linkProxy.src = this.#src;
  }

  clean() {
    try {
      if (this.#src) {
        URL.revokeObjectURL(this.#src);
      }

      if (this.#linkProxy) {
        this.#linkProxy.remove();
        this.#linkProxy = null;
      }
    } catch (err) {
      console.warn("Error cleaning link proxy");
      console.warn(err);
    }
  }

  check(x: number, y: number) {
    if (!this.#linkProxy || !this.#linkProxy.contentDocument) {
      return null;
    }

    return this.#linkProxy.contentDocument.elementFromPoint(x, y);
  }
}

export class GraphComment extends PIXI.Container {
  #maxWidth = 180;
  #isDirty = true;
  #lineWidth = 1;
  #selectedLineWidth = 2;
  #borderRadius = 8;
  #padding = 12;
  #text: string | null = null;
  #textLabel = new PIXI.HTMLText({
    text: "",
    style: {
      fontSize: 12,
      fontFamily: "Arial",
      fill: emptyTextColor,
      wordWrap: true,
      breakWords: true,
      wordWrapWidth: this.#maxWidth - 2 * this.#padding,
      lineHeight: 18,
      tagStyles: {
        a: {
          fill: linkColor,
          fontWeight: "bold",
        },
      },
    },
  });
  #editable = false;
  #selected = false;
  #background = new PIXI.Graphics();
  #defaultBorderColor = defaultBorderColor;
  #selectedBorderColor = selectedBorderColor;
  #graphCommentProxy: GraphCommentProxy | null = null;

  collapsed = false;

  constructor() {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#isDirty = false;
      this.#background.clear();
      this.#draw();

      this.emit(GRAPH_OPERATIONS.GRAPH_COMMENT_DRAWN);
    };

    this.#textLabel.eventMode = "none";
    this.#background.eventMode = "auto";

    this.addChild(this.#background);
    this.addChild(this.#textLabel);

    this.#textLabel.x = this.#padding;
    this.#textLabel.y = this.#padding;

    this.interactive = true;
  }

  override destroy(options?: PIXI.DestroyOptions | undefined): void {
    super.destroy(options);

    if (!this.#graphCommentProxy) {
      return;
    }

    this.#graphCommentProxy.clean();
  }

  addPointerEventListeners() {
    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let hasMoved = false;

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!(evt.target instanceof GraphComment)) {
        return;
      }

      hasMoved = false;
      dragStart = evt.global.clone();
      originalPosition = this.position.clone();
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition) {
          return;
        }

        const scale = this.worldTransform.a;
        const dragPosition = evt.global;
        const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
        const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

        this.x = Math.round(originalPosition.x + dragDeltaX);
        this.y = Math.round(originalPosition.y + dragDeltaY);
        hasMoved = true;

        this.cursor = "grabbing";
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, false);
      }
    );

    const onPointerUp = async (evt: PIXI.FederatedPointerEvent) => {
      dragStart = null;
      originalPosition = null;
      if (!hasMoved) {
        if (this.#graphCommentProxy) {
          const local = evt.getLocalPosition(this);
          const hit = await this.#graphCommentProxy.check(local.x, local.y);

          if (hit !== null && hit.getAttribute("href") !== null) {
            const url = hit.getAttribute("href");
            if (url) {
              if (url.startsWith("board:")) {
                this.emit(
                  GRAPH_OPERATIONS.GRAPH_BOARD_LINK_CLICKED,
                  url.replace(/board:/, "")
                );
                return;
              }

              window.open(url, "_blank", "noopener");
              return;
            }
          }
        }

        return;
      }

      hasMoved = false;
      this.cursor = "pointer";
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, true);
    };

    this.addEventListener("pointerupoutside", onPointerUp);
    this.addEventListener("pointerup", onPointerUp);
  }

  set selected(selected: boolean) {
    if (this.#selected === selected) {
      return;
    }

    this.#selected = selected;
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
  }

  set editable(editable: boolean) {
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
  }

  set text(text: string | null) {
    if (text === this.#text) {
      return;
    }

    this.#isDirty = true;
    this.#text = text;
    if (!text) {
      this.#textLabel.text = "No comment";
      this.#textLabel.style.fill = emptyTextColor;
      this.#textLabel.style.fontStyle = "italic";
      return;
    }

    const renderedText = markdown.renderInline(text);
    this.#textLabel.text = renderedText;
    this.#textLabel.style.fill = textColor;
    this.#textLabel.style.fontStyle = "normal";

    if (this.#graphCommentProxy) {
      this.#graphCommentProxy.clean();
    }

    // Only create a proxy if the node looks to include links.
    if (!renderedText.includes('href="')) {
      return;
    }

    this.#graphCommentProxy = new GraphCommentProxy(
      this.#padding,
      this.#maxWidth,
      renderedText,
      this.#textLabel.style.cssStyle
    );
  }

  get text() {
    return this.#text;
  }

  #draw() {
    const width = Math.max(100, this.#textLabel.width + this.#padding * 2);
    const height = this.#textLabel.height + this.#padding * 2;

    const borderWidth = this.selected
      ? this.#selectedLineWidth
      : this.#lineWidth;
    const borderColor = this.selected
      ? this.#selectedBorderColor
      : this.#defaultBorderColor;

    this.#background.beginPath();
    this.#background.roundRect(0, 0, width, height, this.#borderRadius);
    this.#background.stroke({ color: borderColor, width: borderWidth });
    this.#background.fill({ color: backgroundColor, alpha: 0.1 });
    this.#background.closePath();
  }
}
