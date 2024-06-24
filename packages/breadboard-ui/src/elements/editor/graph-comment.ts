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
const linkColor = getGlobalColor("--bb-ui-500");
const defaultBorderColor = getGlobalColor("--bb-neutral-500");
const selectedBorderColor = getGlobalColor("--bb-ui-600");

type LinkData = {
  url: string;
  rects: DOMRectList;
};

/**
 * This class acts a link proxy. Under the hood Pixi.js uses a Foreign Object in
 * SVG to do the rendering for an HTMLText instance. We replicate that here to
 * derive the rectangles for any elements.
 *
 * To implement this we create a temporary iframe clipped so it renders but does
 * not appear within the viewport. This iframe contains markup with the same
 * styles that Pixi used. We then interrogate the anchor elements and their
 * rects, providing that back to the main GraphComment class.
 */
class GraphCommentProxy {
  #src: string | null = null;
  #linkProxy: HTMLIFrameElement | null = null;
  readonly hitAreaData: Promise<LinkData[]> | null = null;

  constructor(padding: number, html: string, styles: string) {
    this.#linkProxy = document.createElement("iframe");
    this.#linkProxy.setAttribute("seamless", "seamless");
    this.#linkProxy.style["position"] = "fixed";
    this.#linkProxy.style["top"] = "0";
    this.#linkProxy.style["left"] = "0";
    this.#linkProxy.style["zIndex"] = "10000";
    this.#linkProxy.style["clipPath"] = "rect(0 0 0 0)";
    this.#linkProxy.style["pointerEvents"] = "none";
    document.body.appendChild(this.#linkProxy);

    const proxyDoc = this.#linkProxy.contentDocument;
    if (!proxyDoc) {
      console.warn("Unable to access link proxy - no content document");
      return;
    }

    this.#src = URL.createObjectURL(
      new Blob(
        [
          `<style> html, body { margin: 0; ${padding}px; }</style>
          <style>
            ${styles}
          </style>
          <div>${html}</div>`,
        ],
        { type: "text/html" }
      )
    );

    this.#linkProxy.src = this.#src;

    this.hitAreaData = new Promise<LinkData[]>((resolve, reject) => {
      if (!this.#linkProxy) {
        reject("No link proxy");
        return;
      }

      this.#linkProxy.onload = () => {
        if (!this.#linkProxy || !this.#linkProxy.contentDocument) {
          reject("No link proxy");
          return;
        }

        const shapes: Array<{ url: string; rects: DOMRectList }> = [];
        const links = [
          ...this.#linkProxy.contentDocument.querySelectorAll("a"),
        ];
        for (const link of links) {
          const linkData: LinkData = {
            url: link.href,
            rects: link.getClientRects(),
          };

          shapes.push(linkData);
        }

        resolve(shapes);
      };
    });
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
}

export class GraphComment extends PIXI.Container {
  #maxWidth = 220;
  #isDirty = true;
  #lineWidth = 1;
  #selectedLineWidth = 2;
  #borderRadius = 8;
  #padding = 12;
  #text: string | null = null;
  #textLabel = new PIXI.HTMLText({
    text: "",
    style: {
      fontSize: 14,
      fontFamily: "Arial",
      fill: emptyTextColor,
      wordWrap: true,
      breakWords: true,
      wordWrapWidth: this.#maxWidth - 2 * this.#padding,
      lineHeight: 20,
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
  #hitAreaData: LinkData[] = [];
  #hitAreas = new PIXI.Container();

  collapsed = false;
  readOnly = false;

  constructor() {
    super();

    this.eventMode = "static";
    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#isDirty = false;
      this.#background.clear();
      for (const child of this.#hitAreas.removeChildren()) {
        child.destroy();
      }

      this.#draw();
      this.emit(GRAPH_OPERATIONS.GRAPH_COMMENT_DRAWN);
    };

    this.#textLabel.eventMode = "none";
    this.#background.eventMode = "auto";

    this.addChild(this.#background);
    this.addChild(this.#textLabel);
    this.addChild(this.#hitAreas);

    this.#textLabel.x = this.#padding;
    this.#textLabel.y = this.#padding;
    this.#hitAreas.x = this.#padding;
    this.#hitAreas.y = this.#padding;
  }

  addPointerEventListeners() {
    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let hasMoved = false;

    this.addEventListener("pointerover", () => {
      if (this.readOnly) {
        return;
      }

      this.cursor = "grabbing";
    });

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!(evt.target instanceof GraphComment) || this.readOnly) {
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

        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, false);
      }
    );

    const onPointerUp = () => {
      dragStart = null;
      originalPosition = null;
      if (!hasMoved) {
        return;
      }

      hasMoved = false;
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

    // Only create a proxy if the node looks to include links.
    if (!renderedText.includes('href="')) {
      return;
    }

    const proxy = new GraphCommentProxy(
      this.#padding,
      renderedText,
      this.#textLabel.style.cssStyle
    );

    proxy.hitAreaData?.then((hitAreas) => {
      this.#hitAreaData = hitAreas;
      this.#isDirty = true;

      proxy.clean();
    });
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

    this.#drawHitAreas();
  }

  #drawHitAreas() {
    for (const hitAreaItem of this.#hitAreaData) {
      const hitArea = new PIXI.Graphics();
      hitArea.label = hitAreaItem.url;
      hitArea.cursor = "pointer";

      for (const rect of hitAreaItem.rects) {
        hitArea.beginPath();
        hitArea.rect(rect.x, rect.y, rect.width, rect.height);
        hitArea.closePath();
        hitArea.fill({ color: 0xff00ff, alpha: 0 });
      }

      hitArea.addEventListener(
        "pointerup",
        (evt: PIXI.FederatedPointerEvent) => {
          const url = evt.target.label;
          if (url.startsWith("board:")) {
            this.emit(
              GRAPH_OPERATIONS.GRAPH_BOARD_LINK_CLICKED,
              url.replace(/board:/, "")
            );
            return;
          }

          try {
            const parsedUrl = new URL(url);
            window.open(parsedUrl.href, "_blank", "noopener");
          } catch (err) {
            console.warn(`Unable to parse URL from comment: ${url}`);
            console.warn(err);
          }
        }
      );

      this.#hitAreas.addChild(hitArea);
    }
  }
}
