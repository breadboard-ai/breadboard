/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { Project } from "../../../state";
import { FastAccessSelectEvent } from "../../../events/events";
import { FastAccessMenu } from "../../elements";
import { Template } from "../../../utils/template";

@customElement("bb-text-editor")
export class TextEditor extends LitElement {
  @property()
  set value(value: string) {
    const template = new Template(value);
    template.substitute(({ type, path, title }) => {
      return `<label class="chiclet ${type}" contenteditable="false"><span>{{ ${type} | "${path}" | "</span><span class="visible">${title}</span><span>" }}</span></label>`;
    });
    this.#value = template.raw;
    this.#renderableValue = template.renderable;
  }

  get value(): string {
    return this.#value;
  }

  @property()
  accessor nodeId: string | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor projectState: Project | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-0);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
      line-height: var(--bb-grid-size-6);
      position: relative;
    }

    #editor {
      outline: none;
      display: inline-block;
      min-height: 24px;
      width: 100%;
      line-height: var(--bb-grid-size-6);
    }

    .chiclet {
      cursor: pointer;
      display: inline-flex;
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-7);
      background: var(--bb-neutral-50);
      outline: 1px solid var(--bb-neutral-100);
      color: var(--bb-neutral-700);
      border-radius: var(--bb-grid-size-16);
      border: none;
      height: var(--bb-grid-size-5);
      caret-color: transparent;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      user-select: none;
      white-space: nowrap;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);

      & * {
        caret-color: transparent;
        &::selection {
          background: none;
        }
      }

      & span {
        display: none;

        &.visible {
          display: inline;
          pointer-events: none;
        }
      }

      &.in {
        background: var(--bb-input-50) var(--bb-icon-output) 8px center / 16px
          16px no-repeat;
        outline: 1px solid var(--bb-input-100);
        color: var(--bb-input-700);
      }

      &.asset {
        background: var(--bb-asset-50) var(--bb-icon-text) 8px center / 16px
          16px no-repeat;
        outline: 1px solid var(--bb-asset-100);
        color: var(--bb-asset-700);
      }

      &.tool {
        background: var(--bb-tool-50) var(--bb-icon-tool) 8px center / 16px 16px
          no-repeat;
        outline: 1px solid var(--bb-tool-100);
        color: var(--bb-tool-700);
      }

      &.selected {
        background-color: var(--bb-ui-500);
        outline: 1px solid var(--bb-ui-700);
        color: var(--bb-neutral-0);
      }
    }

    bb-fast-access-menu {
      display: none;
      position: absolute;
      z-index: 10;

      &.active {
        display: block;
        left: var(--fast-access-x, 10);
        top: var(--fast-access-y, 10);
      }
    }

    #proxy {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 0;
      background: red;
    }
  `;

  #value = "";
  #renderableValue = "";
  #isUsingFastAccess = false;
  #editorRef: Ref<HTMLDivElement> = createRef();
  #proxyRef: Ref<HTMLDivElement> = createRef();
  #fastAccessRef: Ref<FastAccessMenu> = createRef();

  #onGlobalPointerDownBound = this.#onGlobalPointerDown.bind(this);
  #startTrackingSelectionsBound = this.#startTrackingSelections.bind(this);
  #stopTrackingSelectionsBound = this.#stopTrackingSelections.bind(this);
  #checkSelectionsBound = this.#checkChicletSelections.bind(this);
  #shouldCheckSelections = false;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("selectionchange", this.#checkSelectionsBound, {
      capture: true,
    });

    // The first pointer down is a typical bubble event handler for hiding the
    // fast access menu. The second one tracks selections, and must be done as a
    // capture to avoid propagation being stopped.
    window.addEventListener("pointerdown", this.#onGlobalPointerDownBound);
    window.addEventListener("pointerdown", this.#startTrackingSelectionsBound, {
      capture: true,
    });
    window.addEventListener("pointermove", this.#checkSelectionsBound, {
      capture: true,
    });
    window.addEventListener("pointerup", this.#stopTrackingSelectionsBound, {
      capture: true,
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("selectionchange", this.#checkSelectionsBound, {
      capture: true,
    });
    window.removeEventListener("pointerdown", this.#onGlobalPointerDownBound);
    window.removeEventListener(
      "pointerdown",
      this.#startTrackingSelectionsBound,
      { capture: true }
    );
    window.removeEventListener("pointermove", this.#checkSelectionsBound, {
      capture: true,
    });
    window.removeEventListener("pointerup", this.#stopTrackingSelectionsBound, {
      capture: true,
    });
  }

  #onGlobalPointerDown() {
    this.#hideFastAccess();
  }

  #startTrackingSelections(evt: Event) {
    this.#clearChicletSelections();
    this.#selectChicletIfPossible(evt);

    const [topItem] = evt.composedPath();
    if (!(topItem instanceof HTMLElement)) {
      return;
    }

    this.#shouldCheckSelections = topItem === this.#editorRef.value;
  }

  #stopTrackingSelections(evt: PointerEvent) {
    if (!this.#shouldCheckSelections) {
      return;
    }

    this.#shouldCheckSelections = false;
    this.#checkSelectionsBound(evt);
  }

  #add(path: string, title: string, type: string) {
    if (!this.#editorRef.value) {
      return null;
    }

    const spaceAfter = document.createTextNode(String.fromCharCode(160));
    const label = document.createElement("label");
    const preamableText = document.createElement("span");
    const titleText = document.createElement("span");
    const postamableText = document.createElement("span");
    label.classList.add("chiclet");
    label.classList.add(type);
    label.dataset.path = path;

    preamableText.textContent = Template.preamble({ title, path, type });
    postamableText.textContent = Template.postamble();
    titleText.textContent = title;
    titleText.classList.add("visible");

    label.appendChild(preamableText);
    label.appendChild(titleText);
    label.appendChild(postamableText);
    label.contentEditable = "false";

    const range = this.#getCurrentRange();
    if (!range) {
      this.#editorRef.value.appendChild(label);
      this.#editorRef.value.appendChild(spaceAfter);
    } else {
      if (
        range.commonAncestorContainer !== this.#editorRef.value &&
        range.commonAncestorContainer.parentNode !== this.#editorRef.value
      ) {
        this.#editorRef.value.appendChild(label);
        this.#editorRef.value.appendChild(spaceAfter);
        return label;
      }

      range.deleteContents();

      // The range doesn't move, so insert the nodes in reverse order.
      range.insertNode(spaceAfter);
      range.insertNode(label);

      range.setStartAfter(spaceAfter);
      range.collapse(true);

      requestAnimationFrame(() => {
        const selection = this.#getCurrentSelection();
        if (!selection) {
          return;
        }

        selection.removeAllRanges();
        selection.addRange(range);
        this.#captureEditorValue();
      });
    }
  }

  #getCurrentRange(): Range | null {
    if (!this.shadowRoot) {
      return null;
    }

    const selection = this.#getCurrentSelection();
    if (!selection) {
      return null;
    }

    return selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  }

  #getCurrentSelection(): Selection | null {
    if (!this.shadowRoot) {
      return null;
    }

    let selection: Selection | null = null;
    if ("getSelection" in this.shadowRoot) {
      // @ts-expect-error New API.
      selection = this.shadowRoot.getSelection() as Selection | null;
    } else {
      // Safari should not be rendered with this control as it does not have
      // the APIs necessary to power the editor.
      if (selection && "getComposedRanges" in selection) {
        return null;
      }
      selection = window.getSelection();
    }

    return selection;
  }

  #selectChicletIfPossible(evt: Event) {
    const [possibleChiclet] = evt.composedPath();
    if (!(possibleChiclet instanceof HTMLElement)) {
      return;
    }

    if (!possibleChiclet.classList.contains("chiclet")) {
      return;
    }

    evt.preventDefault();
    possibleChiclet.classList.toggle("selected");

    const selection = this.#getCurrentSelection();
    if (!selection) {
      return;
    }

    const range = new Range();
    range.selectNode(possibleChiclet);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #ensureTrailingSpace() {
    if (!this.#editorRef.value) {
      return;
    }

    const lastChild = this.#editorRef.value.lastChild;
    const isTextNode = lastChild?.nodeType === Node.TEXT_NODE;
    if (
      !lastChild ||
      !isTextNode ||
      (isTextNode && lastChild.textContent === "")
    ) {
      const spaceAfter = document.createTextNode(String.fromCharCode(160));
      this.#editorRef.value.append(spaceAfter);

      const selection = this.#getCurrentSelection();
      if (!selection) {
        return;
      }

      const range = new Range();
      range.setStartBefore(spaceAfter);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  #captureEditorValue() {
    if (!this.#editorRef.value) {
      return;
    }

    // Replace all non-breaking spaces in the emitted string.
    const value = (this.#editorRef.value.textContent ?? "").replace(
      /\u00A0/g,
      String.fromCharCode(32)
    );

    this.#value = value;
    this.dispatchEvent(new InputEvent("input"));
  }

  #sanitizePastedContent(evt: ClipboardEvent) {
    evt.preventDefault();

    if (!this.#editorRef.value) {
      return;
    }

    if (!evt.clipboardData) {
      return;
    }

    this.#editorRef.value.textContent = evt.clipboardData.getData("text");
    this.#captureEditorValue();
  }

  #clearChicletSelections() {
    if (!this.#editorRef.value) {
      return;
    }

    const children = this.#editorRef.value.childNodes;
    for (const child of children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }

      if (!child.classList.contains("chiclet")) {
        continue;
      }

      child.classList.remove("selected");
    }
  }

  #checkChicletSelections(evt: Event) {
    if (!this.#shouldCheckSelections && evt.type !== "selectionchange") {
      return;
    }

    const range = this.#getCurrentRange();
    if (!range) {
      return;
    }

    if (!this.#editorRef.value) {
      return;
    }

    const children = this.#editorRef.value.childNodes;
    for (const child of children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }

      if (!child.classList.contains("chiclet")) {
        continue;
      }

      child.classList.toggle("selected", range.intersectsNode(child));
    }
  }

  focus() {
    if (!this.#editorRef.value) {
      return;
    }

    this.#editorRef.value.focus();
  }

  #showFastAccess(bounds: DOMRect | undefined) {
    if (!bounds) {
      return;
    }

    if (!this.#fastAccessRef.value || !this.#proxyRef.value) {
      return;
    }

    const proxyBounds = this.#proxyRef.value.getBoundingClientRect();
    let top = Math.round(bounds.top - proxyBounds.top);
    let left = Math.round(bounds.left - proxyBounds.left);
    if (left + 240 > proxyBounds.width) {
      left = proxyBounds.width - 240;
    }

    if (bounds.top === 0 || bounds.left === 0) {
      top = 0;
      left = 0;
    }

    this.style.setProperty("--fast-access-x", `${left}px`);
    this.style.setProperty("--fast-access-y", `${top}px`);
    this.#fastAccessRef.value.classList.add("active");
    this.#isUsingFastAccess = true;
  }

  #hideFastAccess() {
    this.#isUsingFastAccess = false;
    if (!this.#fastAccessRef.value) {
      return;
    }

    this.#fastAccessRef.value.classList.remove("active");
  }

  protected firstUpdated(): void {
    if (!this.#editorRef.value) {
      return;
    }

    this.#editorRef.value.innerHTML = this.#renderableValue;
  }

  render() {
    return html` <span
        ${ref(this.#editorRef)}
        @dblclick=${() => {}}
        @paste=${this.#sanitizePastedContent}
        @selectionchange=${this.#checkChicletSelections}
        @keydown=${(evt: KeyboardEvent) => {
          if (this.#isUsingFastAccess) {
            evt.preventDefault();
            return;
          }

          if (this.projectState && evt.key === "@") {
            evt.preventDefault();

            const bounds = this.#getCurrentRange()?.getBoundingClientRect();
            this.#showFastAccess(bounds);
          }
        }}
        @input=${() => {
          this.#ensureTrailingSpace();
          this.#captureEditorValue();
        }}
        id="editor"
        contenteditable="true"
      ></span
      ><bb-fast-access-menu
        ${ref(this.#fastAccessRef)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.preventDefault();
        }}
        @bbfastaccessdismissed=${() => {
          this.#hideFastAccess();
          this.#captureEditorValue();
        }}
        @bbfastaccessselect=${(evt: FastAccessSelectEvent) => {
          this.#hideFastAccess();
          this.#add(evt.path, evt.title, evt.accessType);

          this.#captureEditorValue();
        }}
        .graphId=${this.subGraphId}
        .nodeId=${this.nodeId}
        .state=${this.projectState?.fastAccess}
      ></bb-fast-access-menu>
      <div ${ref(this.#proxyRef)} id="proxy"></div>`;
  }
}
