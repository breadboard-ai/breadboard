/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Template, TemplatePart } from "@breadboard-ai/utils";
import { css, html, LitElement } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { FastAccessSelectEvent } from "../../../events/events.js";

import { FastAccessMenu } from "../../elements.js";
import { isTemplatePart } from "@breadboard-ai/utils";
import { styles as ChicletStyles } from "../../../styles/chiclet.js";
import { getAssetType } from "../../../../utils/media/mime-type.js";
import { icons } from "../../../styles/icons.js";
import { expandChiclet } from "../../../utils/expand-chiclet.js";
import { jsonStringify } from "../../../../utils/formatting/json-stringify.js";
import {
  createTrustedChicletHTML,
  setTrustedHTML,
} from "../../../trusted-types/chiclet-html.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
} from "../../../../a2/a2/tool-manager.js";
import { NOTEBOOKLM_TOOL_PATH } from "@breadboard-ai/utils";
import { SCA } from "../../../../sca/sca.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";

export function chicletHtml(
  part: TemplatePart,
  subGraphId: string | null,
  sca?: SCA
) {
  const { type, invalid, mimeType } = part;
  const assetType = getAssetType(mimeType) ?? "";
  const { icon: srcIcon, tags: metadataTags } = expandChiclet(
    part,
    subGraphId,
    sca
  );

  const { title, path, instance } = part;
  let metadataIcon = srcIcon;
  let sourceTitle = title;
  const label = document.createElement("label");
  label.classList.add("chiclet");

  if (metadataTags) {
    for (const tag of metadataTags) {
      // Ensure we don't have any non-word chars in the tags.
      label.classList.add(tag.replace(/\W/gim, ""));
    }
  }

  if (type) {
    // Ensure we don't have any non-word chars in the type.
    label.classList.add(type.replace(/\W/gim, ""));
  }

  if (assetType) {
    // Ensure we don't have any non-word chars in the assetType.
    label.classList.add(assetType.replace(/\W/gim, ""));
  }

  if (invalid) {
    label.classList.add("invalid");
  }

  if (path === ROUTE_TOOL_PATH) {
    label.dataset.parameter = "step";
    sourceTitle = "Go to";
    metadataIcon = "start";
  } else if (path === MEMORY_TOOL_PATH) {
    sourceTitle = "Use Memory";
    metadataIcon = "database";
  } else if (path === NOTEBOOKLM_TOOL_PATH) {
    sourceTitle = "Use NotebookLM";
    metadataIcon = "notebooklm";
  }

  label.setAttribute("contenteditable", "false");

  if (metadataIcon) {
    const icon = document.createElement("span");
    icon.classList.add("g-icon", "filled", "round");
    if (metadataIcon === "notebooklm") {
      icon.classList.add("notebooklm");
    }
    icon.dataset.icon = metadataIcon;

    label.appendChild(icon);
  }

  const preambleEl = document.createElement("span");
  const titleEl = document.createElement("span");
  const postambleEl = document.createElement("span");

  preambleEl.textContent = Template.preamble(part);
  titleEl.textContent = jsonStringify(title);
  titleEl.classList.add("visible-after");
  titleEl.dataset.label = sourceTitle;
  postambleEl.textContent = Template.postamble();

  label.appendChild(preambleEl);
  label.appendChild(titleEl);

  // If there is a target then we need to expand this.
  if (path === ROUTE_TOOL_PATH) {
    let targetIcon;
    let targetTitle;
    if (instance) {
      const { icon, title } = expandChiclet(
        { path: instance, type: "in", title: "unknown" },
        subGraphId,
        sca
      );

      targetTitle = title;
      targetIcon = icon;
    }

    if (targetIcon) {
      const icon = document.createElement("span");
      icon.classList.add("g-icon", "filled", "round", "target");
      icon.dataset.icon = targetIcon;
      label.appendChild(icon);
    }

    const targetTitleEl = document.createElement("span");
    targetTitleEl.classList.add("visible-after", "target");
    targetTitleEl.dataset.label = targetTitle ?? "";
    label.appendChild(targetTitleEl);

    const dropDown = document.createElement("span");
    dropDown.classList.add("g-icon", "filled", "round", "down-arrow");
    dropDown.dataset.icon = "keyboard_arrow_down";
    label.appendChild(dropDown);
  }

  label.appendChild(postambleEl);
  return label.outerHTML;
}

@customElement("bb-text-editor")
export class TextEditor extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  set value(value: string) {
    this.#rawValue = value;
    this.#renderableValue = createTrustedChicletHTML(
      value,
      this.sca,
      this.subGraphId
    );
    // If SCA wasn't available yet, chiclets that depend on graph lookups
    // (e.g. routing chip targets) will render incomplete. Flag for refresh
    // once the context arrives.
    this.#needsChicletRefresh = !this.sca;
    this.#updateEditorValue();
  }

  get value(): string {
    return this.#rawValue;
  }

  get type(): string {
    return "string";
  }

  @property({ reflect: true, type: Boolean })
  accessor supportsFastAccess = true;

  @property()
  accessor nodeId: string | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor readOnly = false;

  @property({ type: Boolean })
  accessor isAgentMode = false;

  static styles = [
    icons,
    ChicletStyles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: light-dark(var(--n-100), var(--n-15));
        font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--light-dark-n-10);
        line-height: var(--bb-grid-size-6);
        position: relative;
      }

      #editor {
        outline: none;
        display: block;
        white-space: break-spaces;
        height: var(--text-editor-height, auto);
        width: 100%;
        min-height: max(var(--bb-grid-size-10), 100%);
        line-height: var(--bb-grid-size-6);
        overflow-y: scroll;
        overflow-x: hidden;
        padding: var(--text-editor-padding-top, var(--bb-grid-size-2))
          var(--text-editor-padding-right, var(--bb-grid-size-2))
          var(--text-editor-padding-bottom, var(--bb-grid-size-2))
          var(--text-editor-padding-left, var(--bb-grid-size-2));
        scrollbar-width: none;

        &.placeholder::before {
          content: "Type your prompt here";
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--light-dark-n-50);
          line-height: var(--bb-grid-size-6);

          position: absolute;
          top: var(--text-editor-padding-top, var(--bb-grid-size-2));
          left: var(--text-editor-padding-left, var(--bb-grid-size-2));
        }
      }

      :host([supportsFastAccess]) #editor.placeholder::before {
        content: "Type your prompt here. Use @ to include other content.";
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
    `,
  ];

  #rawValue = "";
  #renderableValue: TrustedHTML = createTrustedChicletHTML("");
  #needsChicletRefresh = false;
  #isUsingFastAccess = false;
  #showFastAccessMenuOnKeyUp = false;
  #fastAccessTarget: TemplatePart | null = null;
  #lastRange: Range | null = null;
  #editorRef: Ref<HTMLSpanElement> = createRef();
  #proxyRef: Ref<HTMLDivElement> = createRef();
  #fastAccessRef: Ref<FastAccessMenu> = createRef();

  #onGlobalPointerDownBound = this.#onGlobalPointerDown.bind(this);
  #startTrackingSelectionsBound = this.#startTrackingSelections.bind(this);
  #stopTrackingSelectionsBound = this.#stopTrackingSelections.bind(this);
  #checkSelectionsBound = this.#checkChicletSelections.bind(this);
  #onContextMenuBound = this.#onContextMenu.bind(this);
  #shouldCheckSelections = false;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("contextmenu", this.#onContextMenuBound, {
      capture: true,
    });
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

    window.removeEventListener("contextmenu", this.#onContextMenuBound, {
      capture: true,
    });
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

  #onContextMenu(evt: Event) {
    const isOnSelf = evt.composedPath().find((el) => el === this);
    if (!isOnSelf) {
      return;
    }

    evt.stopImmediatePropagation();
  }

  #onGlobalPointerDown() {
    this.#hideFastAccess();
    this.#setFastAccessTarget(null);
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
      this.#triggerFastAccessIfOnStepParam();
      return;
    }

    this.#shouldCheckSelections = false;
    this.#checkSelectionsBound(evt);
  }

  storeLastRange() {
    this.#lastRange = this.#getCurrentRange();
  }

  #isRangeValid(range: Range) {
    return (
      this.#editorRef.value?.contains(range.commonAncestorContainer) ?? false
    );
  }

  restoreLastRange(offsetLastChar = true) {
    if (!this.#lastRange || !this.#isRangeValid(this.#lastRange)) {
      return;
    }

    this.focus();
    const selection = this.#getCurrentSelection();
    if (!selection) {
      return;
    }

    // Expand the range to include the @ symbol.
    if (this.#lastRange.startOffset > 0 && offsetLastChar) {
      this.#lastRange.setStart(
        this.#lastRange.startContainer,
        this.#lastRange.startOffset - 1
      );
    }

    selection.removeAllRanges();
    try {
      selection.addRange(this.#lastRange);
    } catch (err) {
      console.log(err);
    }
  }

  addItem(part: TemplatePart) {
    if (!this.#editorRef.value) {
      return null;
    }

    if (!this.#getCurrentRange()) {
      this.restoreLastRange();
    }

    const completeAddAction = (appendedEl?: ChildNode) => {
      this.#ensureAllChicletsHaveSpace();
      this.#ensureSafeRangePosition();
      this.#captureEditorValue();
      this.#togglePlaceholder();

      this.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );

      // Fresh add of a routing tool – trigger the fast access menu for the
      // step. We wait a frame so that the processing from adding the step has
      // completed (including unsetting the fast access menu target).
      if (part.path === ROUTE_TOOL_PATH && !part.instance) {
        requestAnimationFrame(() => {
          this.#triggerFastAccessIfOnStepParam(appendedEl);
        });
      }
    };

    requestAnimationFrame(() => {
      if (!this.#editorRef.value) {
        return;
      }

      const fragment = document.createDocumentFragment();
      const tempEl = document.createElement("div");
      const chicletHtml = createTrustedChicletHTML(
        `{${JSON.stringify(part)}}`,
        this.sca,
        this.subGraphId
      );

      setTrustedHTML(tempEl, chicletHtml);
      let appendedEl: ChildNode | undefined;
      if (tempEl.firstChild) {
        // We can just take the last item even though this is using a while.
        appendedEl = tempEl.firstChild;
        fragment.append(tempEl.firstChild);
      }

      const range = this.#getCurrentRange();
      if (!range) {
        this.#editorRef.value.appendChild(fragment);
        completeAddAction(appendedEl);
      } else {
        if (
          range.commonAncestorContainer !== this.#editorRef.value &&
          range.commonAncestorContainer.parentNode !== this.#editorRef.value
        ) {
          this.#editorRef.value.appendChild(fragment);
          return fragment;
        }

        range.deleteContents();

        // The range doesn't move, so insert the nodes in reverse order.
        range.insertNode(fragment);
        range.collapse(false);

        requestAnimationFrame(() => {
          const selection = this.#getCurrentSelection();
          if (!selection) {
            return;
          }

          selection.removeAllRanges();
          selection.addRange(range);
          completeAddAction(appendedEl);
        });
      }
    });
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

  /**
   * @param targetChild If set, will force the behavior for this child. Used to
   *   trigger the fast access behavior on newly-added steps.
   */
  #triggerFastAccessIfOnStepParam(targetChild?: ChildNode) {
    if (!this.#editorRef.value) {
      return;
    }

    const children = this.#editorRef.value.childNodes;
    for (const child of children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }

      // Check newly-added chiclets first.
      if (targetChild) {
        if (child !== targetChild) {
          continue;
        }

        if (!child.classList.contains("selected")) {
          const selection = this.#getCurrentSelection();
          if (!selection) {
            console.warn("Unable to select newly added step");
            return;
          }

          const range = new Range();
          range.selectNode(child);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else if (
        !child.classList.contains("chiclet") ||
        !child.classList.contains("selected")
      ) {
        // Check selected chiclets.
        continue;
      }

      // Now confirm this is due to select steps.
      if (!child.dataset.parameter || child.dataset.parameter !== "step") {
        continue;
      }

      // Redirect the fast access add call back to the chiclet rather than the
      // main editor.
      this.storeLastRange();

      // Obtain a part from the child
      this.#setFastAccessTarget(this.#chicletToTemplatePart(child));
      this.#showFastAccess(child.getBoundingClientRect());
    }
  }

  #chicletToTemplatePart(chiclet: HTMLElement): TemplatePart {
    try {
      const chicletValue = new Template(chiclet.textContent);
      if (!chicletValue.hasPlaceholders) {
        throw new Error(`Item is not a valid value: ${chiclet.textContent}`);
      }

      const tmpl = chicletValue.placeholders.at(0);
      if (!isTemplatePart(tmpl)) {
        throw new Error(`Item is not a valid value: ${chiclet.textContent}`);
      }
      return tmpl;
    } catch (err) {
      console.warn(err);
      throw new Error("Unable to parse chiclet into template");
    }
  }

  #nodeIsChiclet(node: Node | null): node is HTMLElement {
    return node instanceof HTMLElement && node.classList.contains("chiclet");
  }

  #ensureSafeRangePosition(evt?: KeyboardEvent) {
    const selection = this.#getCurrentSelection();
    const range = this.#getCurrentRange();

    if (
      range?.startContainer !== range?.endContainer ||
      range?.startOffset !== range?.endOffset
    ) {
      return;
    }

    const focusedNode = range?.startContainer;
    const focusedOffset = range?.startOffset;

    if (
      focusedOffset === undefined ||
      focusedNode === undefined ||
      focusedNode.nodeType !== Node.TEXT_NODE ||
      !selection ||
      !range
    ) {
      return;
    }

    const updateRange = (
      node: Node,
      offset: number,
      preventDefault = false
    ) => {
      try {
        range.setStart(node, offset);
        range.setEnd(node, offset);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (err) {
        console.warn("[Text editor] Unable to set range", err);
      }

      if (evt && preventDefault) {
        evt.preventDefault();
      }
    };

    const nextSiblingIsChiclet = this.#nodeIsChiclet(focusedNode.nextSibling);
    const previousSiblingIsChiclet = this.#nodeIsChiclet(
      focusedNode.previousSibling
    );

    const textContent = focusedNode.textContent!;
    const ensureNotBetweenZWNBPAndChiclet = () => {
      if (textContent.length === focusedOffset && nextSiblingIsChiclet) {
        updateRange(focusedNode, focusedOffset - 1);
      } else if (focusedOffset === 0 && previousSiblingIsChiclet) {
        updateRange(focusedNode, focusedOffset + 1);
      }
    };

    // In the general case (with no keyboard event) we will want to ensure that
    // we are not between a ZWNBSP and a chiclet.
    if (!evt) {
      ensureNotBetweenZWNBPAndChiclet();
      return;
    }

    switch (evt.key) {
      // Skip to the other side of the ZWNBSP character;
      case "ArrowLeft": {
        if (focusedOffset <= 1 && previousSiblingIsChiclet) {
          if (
            focusedNode.previousSibling.previousSibling &&
            focusedNode.previousSibling.previousSibling.nodeType ===
              Node.TEXT_NODE
          ) {
            updateRange(
              focusedNode.previousSibling.previousSibling,
              focusedNode.previousSibling.previousSibling.textContent!.length -
                1,
              true
            );
          }
        }
        break;
      }

      // Skip to the other side of the chiclet plus its ZWNBSP character;
      case "ArrowRight": {
        if (focusedOffset === textContent.length - 1 && nextSiblingIsChiclet) {
          if (
            focusedNode.nextSibling.nextSibling &&
            focusedNode.nextSibling.nextSibling.nodeType === Node.TEXT_NODE
          ) {
            updateRange(focusedNode.nextSibling.nextSibling, 1, true);
          }
        }
        break;
      }

      case "Delete":
      case "Backspace": {
        if (focusedOffset <= 1 && previousSiblingIsChiclet) {
          range.selectNode(focusedNode.previousSibling);
          range.deleteContents();
          updateRange(focusedNode, 0);
        }
        break;
      }

      case "Enter": {
        // End of a text node adjacent to a chiclet.
        if (focusedOffset === textContent.length && nextSiblingIsChiclet) {
          // Move the range back one character before accepting the Enter key
          // since there should already be a space around the chiclet.
          updateRange(focusedNode, focusedOffset - 1);
        }
        break;
      }

      default: {
        ensureNotBetweenZWNBPAndChiclet();
        break;
      }
    }
  }

  // Because we have a contenteditable span at the source we need to make sure
  // each chiclet has at least one space before and after it otherwise things
  // get exceptionally gnarly.
  #ensureAllChicletsHaveSpace() {
    if (!this.#editorRef.value) {
      return;
    }

    const spaceFactory = () => {
      const el = document.createTextNode(String.fromCharCode(65279));
      return el;
    };

    for (const chiclet of this.#editorRef.value.querySelectorAll<HTMLElement>(
      ".chiclet"
    )) {
      const { previousSibling, nextSibling } = chiclet;
      if (
        !previousSibling ||
        !previousSibling.textContent?.endsWith(String.fromCharCode(65279))
      ) {
        if (!previousSibling || previousSibling.nodeType !== Node.TEXT_NODE) {
          const el = spaceFactory();
          this.#editorRef.value.insertBefore(el, chiclet);
        } else {
          previousSibling.textContent += String.fromCharCode(65279);
        }
      }

      if (
        !nextSibling ||
        !nextSibling.textContent?.startsWith(String.fromCharCode(65279))
      ) {
        if (!nextSibling || nextSibling.nodeType !== Node.TEXT_NODE) {
          const el = spaceFactory();
          this.#editorRef.value.insertBefore(el, chiclet.nextSibling);
        } else {
          nextSibling.textContent =
            String.fromCharCode(65279) + nextSibling.textContent;
        }
      }

      // Edge case: here we've discovered <chip>&xFEFF;<chip>, and we now need
      // to expand that to being <chip>&xFEFF;&xFEFF;<chip> so that each chip
      // has its own pair of ZWNBSP characters.
      if (
        previousSibling &&
        previousSibling.nodeType === Node.TEXT_NODE &&
        previousSibling.textContent === String.fromCharCode(65279) &&
        this.#nodeIsChiclet(previousSibling.previousSibling)
      ) {
        previousSibling.textContent += String.fromCharCode(65279);
      }
    }

    // Now check that ZWNBSP characters only exist around chiclets.
    const walker = document.createTreeWalker(
      this.#editorRef.value,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Only process text nodes containing the zero-width space
          if (node.nodeValue !== null && node.nodeValue.includes("\uFEFF")) {
            return NodeFilter.FILTER_ACCEPT;
          }

          return NodeFilter.FILTER_REJECT;
        },
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      const textContent = node.nodeValue;
      if (!textContent) {
        continue;
      }

      // Skip nodes that don't contain the ZWNBSP char.
      if (!textContent.includes("\uFEFF")) {
        continue;
      }

      // Case 1: There is a non-breaking space in the middle of the string. In
      // these cases we remove the space entirely.
      if (
        textContent.length > 1 &&
        textContent.indexOf("\uFEFF") > 0 &&
        textContent.indexOf("\uFEFF") < textContent.length - 1
      ) {
        node.nodeValue = textContent.replace(/\uFEFF/g, "");
      }

      // Case 2: The string in question is just the non-breaking space. Here we
      // will check either side to see if there is a chiclet and remove the
      // non-breaking space if neither side contains a chiclet.
      if (textContent === "\uFEFF") {
        const { previousSibling, nextSibling } = node;
        const hasPrevChiclet =
          previousSibling && this.#nodeIsChiclet(previousSibling);
        const hasNextChiclet = nextSibling && this.#nodeIsChiclet(nextSibling);
        if (!hasPrevChiclet && !hasNextChiclet) {
          node.nodeValue = "";
        }
      } else {
        // Case 3: There is a non-breaking space at the start of the string.
        // Here will ensure that the previous sibling is a chiclet.
        if (textContent.startsWith("\uFEFF")) {
          const prevSibling = node.previousSibling;
          if (!prevSibling || !this.#nodeIsChiclet(prevSibling)) {
            node.nodeValue = textContent.substring(1);
          }
        }

        // Case 4: At the end of the string. Now check that the subsequent node
        // is a chiclet.
        if (textContent.endsWith("\uFEFF")) {
          const nextSibling = node.nextSibling;
          if (!nextSibling || !this.#nodeIsChiclet(nextSibling)) {
            node.nodeValue = textContent.slice(0, -1);
          }
        }
      }
    }
  }

  #captureEditorValue() {
    if (!this.#editorRef.value) {
      return;
    }

    this.#rawValue = (this.#editorRef.value.textContent ?? "").replace(
      /\uFEFF/gim,
      ""
    );
    this.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
  }

  #togglePlaceholder(forcedValue?: boolean) {
    if (!this.#editorRef.value) {
      return;
    }

    this.#editorRef.value.classList.toggle(
      "placeholder",
      forcedValue !== undefined ? forcedValue : this.#rawValue === ""
    );
  }

  #sanitizePastedContent(evt: ClipboardEvent) {
    evt.preventDefault();

    if (!this.#editorRef.value) {
      return;
    }

    if (!evt.clipboardData) {
      return;
    }

    const selection = this.#getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const tempEl = document.createElement("div");
    setTrustedHTML(
      tempEl,
      createTrustedChicletHTML(
        evt.clipboardData.getData("text"),
        this.sca,
        this.subGraphId
      )
    );

    while (tempEl.firstChild) {
      fragment.append(tempEl.firstChild);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(fragment);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);

    this.#captureEditorValue();
    this.#togglePlaceholder();
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

  #focusOnFirstRender = false;
  focus() {
    if (!this.#editorRef.value) {
      this.#focusOnFirstRender = true;
      return;
    }

    const selection = this.#getCurrentSelection();
    if (!selection || !this.#editorRef.value.lastChild) {
      return;
    }

    const range = new Range();
    range.selectNodeContents(this.#editorRef.value);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.#editorRef.value.scrollTop = this.#editorRef.value.scrollHeight;
    this.#editorRef.value.focus();
  }

  #showFastAccess(bounds: DOMRect | undefined) {
    if (!bounds) {
      return;
    }

    if (!this.#fastAccessRef.value || !this.#proxyRef.value) {
      return;
    }

    const containerBounds = this.getBoundingClientRect();
    const proxyBounds = this.#proxyRef.value.getBoundingClientRect();
    let top = Math.round(bounds.top - proxyBounds.top);
    // When targeting a chiclet (routes/steps mode), shift the menu down
    // to keep the triggering chip visible above.
    if (this.#fastAccessTarget !== null) {
      top += Math.round(bounds.height) + 4;
    }
    let left = Math.round(bounds.left - proxyBounds.left);

    // If the fast access menu is about to go off the right, bring it back.
    if (left + 240 > proxyBounds.width) {
      left = proxyBounds.width - 240;
    }

    // Similarly, if it's going to go off the bottom bring it back.
    if (top + 312 > containerBounds.height) {
      top = containerBounds.height - 312;
    }

    if (bounds.top === 0 || bounds.left === 0) {
      top = 0;
      left = 0;
    }

    this.style.setProperty("--fast-access-x", `${left}px`);
    this.style.setProperty("--fast-access-y", `${top}px`);
    this.#fastAccessRef.value.classList.add("active");
    requestAnimationFrame(() => {
      if (!this.#fastAccessRef.value) {
        return;
      }

      this.#fastAccessRef.value.focusFilter();
    });

    const hasTarget = this.#fastAccessTarget !== null;

    this.#fastAccessRef.value.selectedIndex = 0;
    if (this.sca) {
      this.sca.controller.editor.fastAccess.fastAccessMode = hasTarget
        ? "route"
        : "browse";
    }
    this.#isUsingFastAccess = true;
  }

  #hideFastAccess() {
    this.#isUsingFastAccess = false;
    if (this.sca) {
      this.sca.controller.editor.fastAccess.fastAccessMode = null;
    }
    if (!this.#fastAccessRef.value) {
      return;
    }

    this.#fastAccessRef.value.classList.remove("active");
  }

  #setFastAccessTarget(part: TemplatePart | null) {
    this.#fastAccessTarget = part;
    if (this.#fastAccessRef.value && this.#fastAccessTarget !== null) {
      this.#fastAccessRef.value.updateFilter("");
    }
  }

  #updateEditorValue() {
    if (!this.#editorRef.value) {
      return;
    }

    setTrustedHTML(this.#editorRef.value, this.#renderableValue);
    this.#ensureAllChicletsHaveSpace();
    this.#togglePlaceholder();
  }

  protected firstUpdated(): void {
    this.#updateEditorValue();

    if (this.#focusOnFirstRender) {
      this.focus();
    }
  }

  protected updated(): void {
    // The value setter may fire before @consume resolves the SCA context.
    // Once SCA arrives, recompute the chiclet HTML so graph-dependent lookups
    // (e.g. routing chip target titles) render correctly.
    if (this.#needsChicletRefresh && this.sca) {
      this.#needsChicletRefresh = false;
      this.#renderableValue = createTrustedChicletHTML(
        this.#rawValue,
        this.sca,
        this.subGraphId
      );
      this.#updateEditorValue();
    }
  }

  render() {
    return html` <span
        ${ref(this.#editorRef)}
        @dblclick=${() => {}}
        @paste=${this.#sanitizePastedContent}
        @selectionchange=${this.#checkChicletSelections}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (evt.key === "Tab") {
            evt.preventDefault();

            const range = this.#getCurrentRange();
            if (
              range &&
              range.endOffset - range.startOffset === 0 &&
              !evt.shiftKey
            ) {
              const tabNode = document.createTextNode("\t");
              range.insertNode(tabNode);
              range.setStartAfter(tabNode);
              range.setEndAfter(tabNode);

              const selection = this.#getCurrentSelection();
              if (!selection) {
                return;
              }
              selection.removeAllRanges();
              selection.addRange(range);
            }
            return;
          }

          if ((evt.key === "c" || evt.key === "x") && isCtrlCommand) {
            evt.preventDefault();

            const range = this.#getCurrentRange();
            if (range) {
              navigator.clipboard.writeText(
                range.toString().replace(/\uFEFF/gim, "")
              );

              if (evt.key === "x") {
                range.deleteContents();
              }
            }

            return;
          }

          if (evt.key === "@") {
            this.#showFastAccessMenuOnKeyUp = true;
          }

          if (/\W/.test(evt.key)) {
            this.#togglePlaceholder(false);
          }
          this.#ensureSafeRangePosition(evt);
        }}
        @keyup=${(evt: KeyboardEvent) => {
          if (this.#isUsingFastAccess) {
            evt.preventDefault();
            return;
          }

          if (
            this.sca &&
            this.supportsFastAccess &&
            this.#showFastAccessMenuOnKeyUp
          ) {
            this.#showFastAccessMenuOnKeyUp = false;
            this.storeLastRange();
            const bounds = this.#lastRange?.getBoundingClientRect();
            this.#showFastAccess(bounds);
          }
          this.#togglePlaceholder();
        }}
        @input=${() => {
          this.#ensureAllChicletsHaveSpace();
          this.#captureEditorValue();
          this.#togglePlaceholder();
        }}
        id="editor"
        contenteditable=${!this.readOnly}
      ></span
      ><bb-fast-access-menu
        ${ref(this.#fastAccessRef)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bbfastaccessdismissed=${() => {
          this.#hideFastAccess();
          this.#captureEditorValue();
          this.restoreLastRange();
          this.#setFastAccessTarget(null);
        }}
        @bbfastaccessselect=${(evt: FastAccessSelectEvent) => {
          this.#hideFastAccess();
          this.restoreLastRange();

          // By default we assume that the part to be added is constructed from
          // the event we received in.
          let targetPart: TemplatePart = {
            path: evt.path,
            title: evt.title,
            type: evt.accessType,
            mimeType: evt.mimeType,
            instance: evt.instance,
          };

          // If, however, there is a fast access target, i.e., an existing
          // TemplatePart, we should adjust it so that the newly added part is
          // set as the parameterTarget.
          if (this.#fastAccessTarget !== null) {
            targetPart = {
              ...this.#fastAccessTarget,
              instance: evt.path,
              title: evt.title,
            };
          }

          this.addItem(targetPart);

          this.#setFastAccessTarget(null);
          this.#captureEditorValue();
          this.#togglePlaceholder();
        }}
      ></bb-fast-access-menu>
      <div ${ref(this.#proxyRef)} id="proxy"></div>`;
  }
}
