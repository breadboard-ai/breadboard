/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  assertHTMLElement,
  assertPointerEvent,
  assertRoot,
  assertSVGElement,
} from "./utils/assertions.js";

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.6.1/+esm";
const MERMAID_STYLES = `.node.active > * {
  stroke-width: 4px;
  stroke: #4CE8F6 !important;
}

.node.default > * {
  stroke: #ffab40;
  fill: #fff2ccff;
  color: #000;
}

.node.secrets > * {
  stroke: #db4437;
  fill: #f4cccc;
}

.node.input > * {
  stroke: #3c78d8;
  fill: #c9daf8ff;
}

.node.output > * {
  stroke: #38761d;
  fill: #b6d7a8ff;
}

.node.passthrough {
  stroke: #a64d79;
  fill: #ead1dcff;
}

.node.slot {
  stroke: #a64d79;
  fill: #ead1dcff;
}

.node.slotted {
  stroke: #a64d79;
}
`;

const enum MODE {
  SELECT,
  PAN,
  ZOOM_IN,
  ZOOM_OUT,
}

export class Diagram extends HTMLElement {
  #mode = MODE.PAN;
  #translation = { x: Number.NaN, y: Number.NaN };
  #transformOrigin = { x: "50%", y: "50%" };
  #diagramDimensions = { w: Number.NaN, h: Number.NaN };
  #diagramElementDimensions = { w: Number.NaN, h: Number.NaN };
  #scale = 0.85;

  #isInteracting = false;
  #pointer = { x: 0, y: 0 };
  #baseTranslation = { ...this.#translation };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    assertRoot(root);

    root.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          user-select: none;
          pointer-events: auto;
          cursor: auto;
        }

        :host(.pan) {
          cursor: grab;
        }

        :host(.zoom-in) {
          cursor: zoom-in;
        }

        :host(.zoom-out) {
          cursor: zoom-out;
        }

        svg {
          display: block;
          pointer-events: none;
        }

        #mermaid {
          width: 100%;
          height: 100%;
        }

        #controls {
          width: calc(var(--bb-grid-size) * 8);
          position: absolute;
          top: calc(var(--bb-grid-size) * 4);
          left: calc(var(--bb-grid-size) * 4);
          padding: calc(var(--bb-grid-size) * 0.5);
          background: rgb(255, 255, 255);
          border: 1px solid rgb(237, 237, 237);
          border-radius: calc(var(--bb-grid-size) * 2);
          cursor: auto;
          z-index: 1;
        }

        #controls > button {
          width: 32px;
          height: 32px;
          font-size: 0;
          border-radius: calc(var(--bb-grid-size) * 1.5);
          border: none;
          background-color: rgb(255, 255, 255);
          background-position: center center;
          background-repeat: no-repeat;
          opacity: 0.5;
          display: block;
          margin-top: 4px;
          cursor: pointer;
        }

        #controls > button:first-of-type {
          margin-top: 0;
        }

        #controls > button#select {
          background-image: var(--bb-icon-arrow);
        }

        #controls > button#pan {
          background-image: var(--bb-icon-pan);
        }

        #controls > button#zoom-in {
          background-image: var(--bb-icon-zoom-in);
        }

        #controls > button#zoom-out {
          background-image: var(--bb-icon-zoom-out);
        }

        #controls > button#fit {
          background-image: var(--bb-icon-fit);
        }

        #controls > button:hover,
        #controls > button.active {
          background-color: rgb(230, 241, 242);
          opacity: 1;
        }
      </style>
      <div id="controls">
        <button id="select" title="Select">Select</button>
        <button id="pan" title="Pan">Pan</button>
        <button id="zoom-in" title="Zoom In">Zoom In</button>
        <button id="zoom-out" title="Zoom Out">Zoom Out</button>
        <button id="fit" title="Fit to Screen">Fit to Screen</button>
      </div>
      <div id="mermaid"></div>
    `;

    this.reset();
    this.#updateControls();
    this.#updateContainerClass();

    this.addEventListener("pointerdown", (evt: Event) =>
      this.#onPointerDown(evt)
    );

    this.addEventListener("pointermove", (evt: Event) => {
      this.#onPointerMove(evt);
    });

    document.body.addEventListener("pointerup", () => {
      this.#onPointerUp();
    });

    root.addEventListener("click", (evt: Event) => this.#onClick(evt));

    window.addEventListener("resize", () => this.#onWindowResize());
  }

  #onClick(evt: Event) {
    const target = evt.target;
    assertHTMLElement(target);

    switch (target.id) {
      case "select":
        this.#mode = MODE.SELECT;
        break;

      case "pan":
        this.#mode = MODE.PAN;
        break;

      case "zoom-in":
        this.#mode = MODE.ZOOM_IN;
        break;

      case "zoom-out":
        this.#mode = MODE.ZOOM_OUT;
        break;

      case "fit": {
        this.#scale = 0.85;
        this.#translation.x = 0;
        this.#translation.y = 0;
        this.#mode = MODE.PAN;
        this.#attemptUpdateViewBox();
        break;
      }

      default:
        {
          if (this.#mode === MODE.ZOOM_IN) {
            this.#scale *= 1.2;
          } else if (this.#mode === MODE.ZOOM_OUT) {
            this.#scale *= 0.8;
          }

          this.#attemptUpdateViewBox();
        }
        break;
    }

    this.#updateControls();
    this.#updateContainerClass();
  }

  #onPointerDown(evt: Event) {
    this.#isInteracting = true;

    assertPointerEvent(evt);

    this.#pointer.x = evt.clientX;
    this.#pointer.y = evt.clientY;

    this.#baseTranslation.x = this.#translation.x;
    this.#baseTranslation.y = this.#translation.y;
  }

  #onPointerMove(evt: Event) {
    if (!this.#isInteracting || this.#mode !== MODE.PAN) {
      return;
    }

    assertPointerEvent(evt);

    this.setPointerCapture(evt.pointerId);

    this.#translation.x =
      this.#baseTranslation.x - (evt.clientX - this.#pointer.x);
    this.#translation.y =
      this.#baseTranslation.y - (evt.clientY - this.#pointer.y);

    this.#attemptUpdateViewBox();
  }

  #onPointerUp() {
    this.#isInteracting = false;
    this.#pointer.x = 0;
    this.#pointer.y = 0;
  }

  #onWindowResize() {
    const root = this.shadowRoot;
    assertRoot(root);

    const svgImage = root.querySelector("svg");
    assertSVGElement(svgImage);

    this.#diagramElementDimensions.w = svgImage.clientWidth;
    this.#diagramElementDimensions.h = svgImage.clientHeight;

    this.#attemptUpdateViewBox();
  }

  #updateControls() {
    const root = this.shadowRoot;
    assertRoot(root);

    const controls = root.querySelector("#controls");
    assertHTMLElement(controls);

    const buttons = Array.from(controls.querySelectorAll("button"));
    for (const button of buttons) {
      button.classList.remove("active");
    }

    let selector = "#select";
    switch (this.#mode) {
      case MODE.SELECT:
        selector = "#select";
        break;

      case MODE.PAN:
        selector = "#pan";
        break;

      case MODE.ZOOM_IN:
        selector = "#zoom-in";
        break;

      case MODE.ZOOM_OUT:
        selector = "#zoom-out";
        break;
    }

    const btn = root.querySelector(selector);
    if (!btn) {
      return;
    }

    btn.classList.add("active");
  }

  #updateContainerClass() {
    this.classList.remove("pan", "zoom-in", "zoom-out");
    switch (this.#mode) {
      case MODE.PAN:
        this.classList.add("pan");
        break;

      case MODE.ZOOM_IN:
        this.classList.add("zoom-in");
        break;

      case MODE.ZOOM_OUT:
        this.classList.add("zoom-out");
        break;
    }
  }

  #attemptUpdateViewBox() {
    const root = this.shadowRoot;
    assertRoot(root);

    const svgImage = root.querySelector("svg");
    if (!svgImage) {
      return;
    }

    const viewBox = svgImage?.getAttribute("viewBox");
    if (!viewBox) {
      return;
    }

    const viewBoxWidth = this.#diagramDimensions.w;
    const viewBoxHeight = this.#diagramDimensions.h;

    const innerGraphic = svgImage.querySelector("g");
    assertSVGElement(innerGraphic);
    innerGraphic.style.transformOrigin = `${this.#transformOrigin.x} ${
      this.#transformOrigin.y
    }`;
    innerGraphic.style.transform = `scale(${this.#scale}, ${this.#scale})`;

    const ratio = Math.min(
      this.#diagramElementDimensions.w / viewBoxWidth,
      this.#diagramElementDimensions.h / viewBoxHeight
    );

    const newViewBox = `${this.#translation.x / ratio} ${
      this.#translation.y / ratio
    } ${viewBoxWidth} ${viewBoxHeight}`;
    svgImage.setAttribute("viewBox", newViewBox);
  }

  #captureSVGViewBoxSize() {
    const root = this.shadowRoot;
    assertRoot(root);

    const svgImage = root.querySelector("svg");
    if (!svgImage) {
      return;
    }

    const viewBox = svgImage?.getAttribute("viewBox");
    if (!viewBox) {
      return;
    }

    const [, , w, h] = viewBox.split(" ").map((i) => parseFloat(i) || 0);
    this.#diagramDimensions.w = w;
    this.#diagramDimensions.h = h;
  }

  #setDefaultViewBoxTranslation() {
    this.#translation.x = 0;
    this.#translation.y = 0;
  }

  async render(diagram: string, highlightedNode: string) {
    highlightedNode = highlightedNode.replace(/-/g, "");
    if (highlightedNode) {
      diagram += `\nclass ${highlightedNode} active`;
    }

    const module = await import(/* @vite-ignore */ MERMAID_URL);
    const mermaid = module.default;
    mermaid.initialize({ startOnLoad: false, themeCSS: MERMAID_STYLES });
    const { svg } = await mermaid.render("graphDiv", diagram);
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to find shadow root");
    }

    const mermaidElement = root.querySelector("#mermaid");
    if (!mermaidElement) {
      return;
    }
    mermaidElement.innerHTML = svg;

    // Do a little tidy up.
    const svgImage = root.querySelector("svg");
    assertSVGElement(svgImage);

    svgImage.removeAttribute("style");
    svgImage.setAttribute("width", "100%");
    svgImage.setAttribute("height", "100%");
    svgImage.setAttribute("preserveAspectRatio", "xMidYMid");

    if (
      Number.isNaN(this.#diagramDimensions.w) ||
      Number.isNaN(this.#diagramDimensions.h)
    ) {
      this.#captureSVGViewBoxSize();
    }

    if (
      Number.isNaN(this.#translation.x) ||
      Number.isNaN(this.#translation.y)
    ) {
      this.#setDefaultViewBoxTranslation();
    }

    if (
      Number.isNaN(this.#diagramElementDimensions.w) ||
      Number.isNaN(this.#diagramElementDimensions.h)
    ) {
      this.#onWindowResize();
    }

    this.#attemptUpdateViewBox();
  }

  reset() {
    this.#mode = MODE.PAN;
    this.#translation.x = Number.NaN;
    this.#translation.y = Number.NaN;
    this.#diagramDimensions.w = Number.NaN;
    this.#diagramDimensions.w = Number.NaN;
    this.#diagramElementDimensions.w = Number.NaN;
    this.#diagramElementDimensions.h = Number.NaN;
    this.#scale = 0.85;
    this.#transformOrigin.x = "50%";
    this.#transformOrigin.y = "50%";
  }
}
