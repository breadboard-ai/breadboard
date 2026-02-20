/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { TemplatePart } from "@breadboard-ai/utils";
import { isTemplatePart, Template } from "@breadboard-ai/utils";
import { css, html, LitElement, nothing } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

import { FastAccessSelectEvent } from "../../../events/events.js";
import { FastAccessMenu } from "../../elements.js";
import { styles as ChicletStyles } from "../../../styles/chiclet.js";
import { icons } from "../../../styles/icons.js";
import { expandChiclet } from "../../../utils/expand-chiclet.js";
import { jsonStringify } from "../../../utils/json-stringify.js";
import {
  ROUTE_TOOL_PATH,
  MEMORY_TOOL_PATH,
} from "../../../../a2/a2/tool-manager.js";
import { NOTEBOOKLM_TOOL_PATH } from "@breadboard-ai/utils";
import type { SCA } from "../../../../sca/sca.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";

import { EditorModel } from "./editor-model.js";
import type { ChicletSegment, Segment } from "./editor-model.js";
import { EditorSelection, caretPositionFromPoint } from "./editor-selection.js";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@customElement("bb-text-editor-remix")
export class TextEditorRemix extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  set value(value: string) {
    // Bail when the incoming value matches what we already have.
    // Without this guard, every parent re-render clobbers in-progress edits
    // and regenerates render segment keys, causing Lit to destroy/recreate
    // all DOM nodes inside the contenteditable.
    if (value === this.#rawValue) return;

    this.#rawValue = value;
    this.#model.replaceAll(value);
    this.#renderSegments = this.#buildRenderSegments();
    this.requestUpdate();
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
  accessor subGraphId: string | null = null;

  @property()
  accessor readOnly = false;

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
      }

      #placeholder {
        font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--light-dark-n-50);
        line-height: var(--bb-grid-size-6);
        position: absolute;
        top: var(--text-editor-padding-top, var(--bb-grid-size-2));
        left: var(--text-editor-padding-left, var(--bb-grid-size-2));
        pointer-events: none;
      }

      .chiclet {
        cursor: grab;

        &.dragging {
          opacity: 0.3;
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
      }
    `,
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  #rawValue = "";
  #model = EditorModel.empty();
  #selection!: EditorSelection;
  #renderSegments: Segment[] = [];
  #pendingCursorOffset: number | null = null;
  #pendingCursorAfterChiclet = false;
  #isUsingFastAccess = false;
  #showFastAccessMenuOnKeyUp = false;
  #fastAccessTarget: TemplatePart | null = null;
  #lastRange: Range | null = null;
  #focusOnFirstRender = false;
  #shouldCheckSelections = false;

  // Drag state.
  #dragSourceKey: string | null = null;

  // Snapshot debounce for undo history.
  #snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingSnapshotData: import("./editor-model.js").Snapshot | null = null;
  #fastAccessHistoryAnchor: number | null = null;

  // Refs.
  #editorRef: Ref<HTMLSpanElement> = createRef();
  #proxyRef: Ref<HTMLDivElement> = createRef();
  #fastAccessRef: Ref<FastAccessMenu> = createRef();

  // Bound handlers.
  #onGlobalPointerDownBound = this.#onGlobalPointerDown.bind(this);
  #startTrackingSelectionsBound = this.#startTrackingSelections.bind(this);
  #stopTrackingSelectionsBound = this.#stopTrackingSelections.bind(this);
  #checkSelectionsBound = this.#checkChicletSelections.bind(this);
  #onContextMenuBound = this.#onContextMenu.bind(this);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    super.connectedCallback();

    this.#selection = new EditorSelection(
      this.shadowRoot!,
      () => this.#editorRef.value
    );

    window.addEventListener("contextmenu", this.#onContextMenuBound, {
      capture: true,
    });
    window.addEventListener("selectionchange", this.#checkSelectionsBound, {
      capture: true,
    });
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

  protected firstUpdated(): void {
    if (this.#focusOnFirstRender) {
      this.focus();
    }
  }

  protected override updated(): void {
    // Restore cursor position after Lit finishes rendering.
    // This runs synchronously after the DOM update, before any pending
    // event handlers (e.g. keyup), ensuring storeLastRange captures
    // the correct cursor position.
    if (this.#pendingCursorOffset !== null) {
      const offset = this.#pendingCursorOffset;
      const afterChiclet = this.#pendingCursorAfterChiclet;
      this.#pendingCursorOffset = null;
      this.#pendingCursorAfterChiclet = false;
      this.#selection.setCursorAtCharOffset(offset, afterChiclet);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API (matching bb-text-editor)
  // ---------------------------------------------------------------------------

  storeLastRange(): void {
    this.#lastRange = this.#selection.getRange();
  }

  restoreLastRange(offsetLastChar = true): void {
    if (!this.#lastRange || !this.#selection.isRangeValid(this.#lastRange)) {
      return;
    }

    this.focus();
    this.#selection.restoreRange(this.#lastRange, offsetLastChar);
  }

  async addItem(part: TemplatePart): Promise<void> {
    if (!this.#editorRef.value) return;

    if (!this.#selection.getRange()) {
      this.restoreLastRange();
    }

    // Determine insertion offset from current range.
    const range = this.#selection.getRange();
    let charOffset = this.#selection.rangeToCharOffset(range);

    // Delete any selected content (e.g. the @ trigger character) via model.
    if (range && !range.collapsed) {
      const endRange = range.cloneRange();
      endRange.collapse(false);
      const endOffset = this.#selection.rangeToCharOffset(endRange);
      charOffset = this.#model.deleteAtOffset(
        charOffset,
        endOffset - charOffset
      );
    }

    this.#model.insertChicletAtOffset(charOffset, part);

    // Discard any pending debounced snapshot (e.g., the '@' trigger) so
    // undo jumps straight from pre-@ to post-chiclet.
    this.#pendingSnapshotData = null;
    if (this.#snapshotTimer !== null) {
      clearTimeout(this.#snapshotTimer);
      this.#snapshotTimer = null;
    }

    // If fast access was triggered by '@', rewind history to the anchor
    // (pre-@ state), discarding any committed '@' snapshot.
    if (this.#fastAccessHistoryAnchor !== null) {
      this.#model.truncateHistoryTo(this.#fastAccessHistoryAnchor);
      this.#fastAccessHistoryAnchor = null;
    }

    this.#syncFromModel(charOffset, true, /* immediate */ true);
    this.#captureEditorValue();

    if (part.path === ROUTE_TOOL_PATH && !part.instance) {
      await this.updateComplete;
      this.#triggerFastAccessIfOnStepParam();
    }
  }

  override focus(): void {
    if (!this.#editorRef.value) {
      this.#focusOnFirstRender = true;
      return;
    }
    this.#selection.focusEnd();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  #buildRenderSegments(): Segment[] {
    return this.#model.toRenderSegments();
  }

  #renderChiclet(seg: ChicletSegment, key: string) {
    const { part } = seg;
    const { type, invalid } = part;
    const assetType = part.mimeType ? part.mimeType.split("/")[0] : "";
    const { icon: srcIcon, tags: metadataTags } = expandChiclet(
      part,
      this.subGraphId,
      this.sca
    );

    const { title, path, instance } = part;
    let metadataIcon = srcIcon;
    let sourceTitle = title;

    const classes: Record<string, boolean> = { chiclet: true };

    if (metadataTags) {
      for (const tag of metadataTags) {
        classes[tag.replace(/\W/g, "")] = true;
      }
    }
    if (type) {
      classes[type.replace(/\W/g, "")] = true;
    }
    if (assetType) {
      classes[assetType.replace(/\W/g, "")] = true;
    }
    if (invalid) {
      classes["invalid"] = true;
    }

    if (path === ROUTE_TOOL_PATH) {
      sourceTitle = "Go to";
      metadataIcon = "start";
    } else if (path === MEMORY_TOOL_PATH) {
      sourceTitle = "Use Memory";
      metadataIcon = "database";
    } else if (path === NOTEBOOKLM_TOOL_PATH) {
      sourceTitle = "Use NotebookLM";
      metadataIcon = "notebooklm";
    }

    let targetIcon: string | undefined;
    let targetTitle: string | undefined;
    if (path === ROUTE_TOOL_PATH && instance) {
      const expanded = expandChiclet(
        { path: instance, type: "in", title: "unknown" },
        this.subGraphId,
        this.sca
      );
      targetTitle = expanded.title ?? undefined;
      targetIcon = expanded.icon ?? undefined;
    }

    const preamble = Template.preamble(part);
    const titleText = jsonStringify(title);
    const postamble = Template.postamble();

    const isStep = path === ROUTE_TOOL_PATH;

    const classList = Object.entries(classes)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(" ");

    return html`<label
      class=${classList}
      contenteditable="false"
      data-segment-key=${key}
      ?data-parameter-step=${isStep}
      @pointerdown=${(evt: PointerEvent) =>
        this.#onChicletPointerDown(evt, key)}
      ><span>${preamble}</span>${metadataIcon
        ? html`<span
            class="g-icon filled round ${metadataIcon === "notebooklm"
              ? "notebooklm"
              : ""}"
            data-icon=${metadataIcon}
          ></span>`
        : nothing}<span class="visible-after" data-label=${sourceTitle}
        >${titleText}</span
      >${isStep && targetIcon
        ? html`<span
            class="g-icon filled round target"
            data-icon=${targetIcon}
          ></span>`
        : nothing}${isStep
        ? html`<span
              class="visible-after target"
              data-label=${targetTitle ?? ""}
            ></span
            ><span
              class="g-icon filled round down-arrow"
              data-icon="keyboard_arrow_down"
            ></span>`
        : nothing}<span>${postamble}</span></label
    >`;
  }

  render() {
    return html`
      ${this.#renderEditor()} ${this.#renderFastAccessMenu()}
      <div ${ref(this.#proxyRef)} id="proxy"></div>
    `;
  }

  #renderEditor() {
    const isEmpty = this.#rawValue === "";
    const placeholderText = this.supportsFastAccess
      ? "Type your prompt here. Use @ to include other content."
      : "Type your prompt here";

    return html`
      ${isEmpty
        ? html`<span id="placeholder">${placeholderText}</span>`
        : nothing}
      <span
        ${ref(this.#editorRef)}
        id="editor"
        contenteditable=${!this.readOnly}
        @beforeinput=${this.#onBeforeInput}
        @paste=${this.#onPaste}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
        @selectionchange=${this.#checkChicletSelections}
        >${this.#renderSegments.map((segment, index) => {
          if (segment.kind === "text") {
            return segment.text;
          }
          return this.#renderChiclet(segment, `seg-${index}`);
        })}</span
      >
    `;
  }

  #renderFastAccessMenu() {
    return html`
      <bb-fast-access-menu
        ${ref(this.#fastAccessRef)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bbfastaccessdismissed=${this.#onFastAccessDismissed}
        @bbfastaccessselect=${this.#onFastAccessSelect}
      ></bb-fast-access-menu>
    `;
  }

  // ---------------------------------------------------------------------------
  // Fast access event handlers
  // ---------------------------------------------------------------------------

  #onFastAccessDismissed() {
    this.#hideFastAccess();
    this.#fastAccessHistoryAnchor = null;
    this.#captureEditorValue();
    this.restoreLastRange();
    this.#setFastAccessTarget(null);
  }

  #onFastAccessSelect(evt: FastAccessSelectEvent) {
    this.#hideFastAccess();
    this.restoreLastRange();

    let targetPart: TemplatePart = {
      path: evt.path,
      title: evt.title,
      type: evt.accessType,
      mimeType: evt.mimeType,
      instance: evt.instance ?? undefined,
    };

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
  }

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  #onBeforeInput(evt: InputEvent): void {
    // Controlled input: prevent ALL browser-native editing. Every mutation
    // goes through the model and Lit re-renders the result.
    evt.preventDefault();

    const range = this.#selection.getRange();
    let charOffset = this.#selection.rangeToCharOffset(range);

    // Compute the model segment the DOM cursor is sitting in.
    // This disambiguates positions that share the same visible-text offset
    // (e.g. text nodes between adjacent chiclets all map to offset 0).
    const segmentHint =
      range && range.collapsed
        ? this.#selection.domPositionToSegmentIndex(
            range.startContainer,
            range.startOffset
          )
        : -1;

    // If there's a selection range, delete it first (inclusive boundaries).
    if (range && !range.collapsed) {
      const startOffset = this.#selection.rangeToCharOffset(range);
      const endRange = range.cloneRange();
      endRange.collapse(false);
      const endOffset = this.#selection.rangeToCharOffset(endRange);
      if (endOffset > startOffset) {
        // Capture the pre-delete state with cursor at the selection end so
        // that undo restores the cursor to where the selected text ended.
        this.#flushPendingSnapshot();
        this.#model.pushSnapshot(endOffset);

        charOffset = this.#model.deleteSelection(startOffset, endOffset);
      }
    }

    let newOffset = charOffset;

    switch (evt.inputType) {
      case "insertText": {
        const text = evt.data ?? "";
        newOffset = this.#model.insertTextAtOffset(
          charOffset,
          text,
          segmentHint
        );
        break;
      }

      case "insertParagraph":
      case "insertLineBreak":
        newOffset = this.#model.insertTextAtOffset(
          charOffset,
          "\n",
          segmentHint
        );
        break;

      case "deleteContentBackward":
        newOffset = this.#model.deleteAtOffset(charOffset, -1);
        break;

      case "deleteContentForward":
        newOffset = this.#model.deleteAtOffset(charOffset, 1);
        break;

      case "deleteWordBackward": {
        const wordStart = this.#model.findWordBoundaryBefore(charOffset);
        newOffset = this.#model.deleteAtOffset(
          charOffset,
          wordStart - charOffset
        );
        break;
      }

      case "deleteWordForward": {
        const wordEnd = this.#model.findWordBoundaryAfter(charOffset);
        newOffset = this.#model.deleteAtOffset(
          charOffset,
          wordEnd - charOffset
        );
        break;
      }

      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        // Delete to start of line: delete all chars before cursor.
        newOffset = this.#model.deleteAtOffset(charOffset, -charOffset);
        break;

      case "deleteSoftLineForward":
      case "deleteHardLineForward": {
        const totalLen = this.#model.visibleTextLength;
        newOffset = this.#model.deleteAtOffset(
          charOffset,
          totalLen - charOffset
        );
        break;
      }

      default:
        // Formatting commands and other unhandled types — just block them.
        return;
    }

    // After a delete, if the cursor lands at a chiclet boundary, place it
    // after the chiclet (not before it) so it stays on the side where the
    // deleted text was. For text insertion, the cursor should stay where
    // the text was typed — never jump past a chiclet.
    const isDelete = evt.inputType.startsWith("delete");
    const afterChiclet =
      isDelete && this.#model.hasChicletAtBoundary(newOffset);
    this.#syncFromModel(newOffset, afterChiclet);
    this.#captureEditorValue();
  }

  /**
   * Model-driven paste: splice pasted text into the model's raw value
   * so that `{JSON}` chiclet syntax is parsed back into chiclets.
   */
  #onPaste(evt: ClipboardEvent): void {
    evt.preventDefault();

    const text = evt.clipboardData?.getData("text");
    if (!text) return;

    const range = this.#selection.getRange();
    let charOffset = this.#selection.rangeToCharOffset(range);

    // Delete any selected content via the model.
    if (range && !range.collapsed) {
      const endRange = range.cloneRange();
      endRange.collapse(false);
      const endOffset = this.#selection.rangeToCharOffset(endRange);
      charOffset = this.#model.deleteSelection(charOffset, endOffset);
    }

    // Splice pasted text into the raw value and re-parse so chiclets
    // in the pasted text are reconstituted.
    const isAfterChiclet = this.#model.hasChicletAtBoundary(charOffset);
    const rawOffset = this.#model.charOffsetToRawOffset(
      charOffset,
      isAfterChiclet
    );
    const currentRaw = this.#model.toRawValue();
    const newRaw =
      currentRaw.slice(0, rawOffset) + text + currentRaw.slice(rawOffset);
    this.#model.replaceAll(newRaw, /* resetHistory */ false);

    // Compute new cursor position from pasted content's visible length.
    const pastedModel = EditorModel.fromRawValue(text);
    const newOffset = charOffset + pastedModel.visibleTextLength;
    const afterChiclet = this.#model.hasChicletAtBoundary(newOffset);

    this.#syncFromModel(newOffset, afterChiclet, /* immediate */ true);
    this.#captureEditorValue();
  }

  #onKeyDown(evt: KeyboardEvent): void {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    // Tab handling — route through model.
    if (evt.key === "Tab") {
      evt.preventDefault();
      if (!evt.shiftKey) {
        const range = this.#selection.getRange();
        const charOffset = this.#selection.rangeToCharOffset(range);
        const newOffset = this.#model.insertTextAtOffset(charOffset, "\t");
        this.#syncFromModel(newOffset, false, /* immediate */ true);
        this.#captureEditorValue();
      }
      return;
    }

    // Undo / Redo.
    if (evt.key === "z" && isCtrlCommand) {
      evt.preventDefault();
      // Flush any pending debounced typing snapshot so it's undoable.
      this.#flushPendingSnapshot();
      const result = evt.shiftKey ? this.#model.redo() : this.#model.undo();
      if (result) {
        // Rebuild render segments but don't push a new snapshot.
        this.#renderSegments = this.#buildRenderSegments();

        // When undoing/redoing to empty, skip cursor positioning (there's
        // nothing to position in) and just focus the editor.
        if (this.#model.length === 0) {
          this.#pendingCursorOffset = null;
        } else {
          this.#pendingCursorOffset = result.cursorOffset;
          this.#pendingCursorAfterChiclet = result.afterChiclet;
        }

        this.requestUpdate();
        this.#captureEditorValue();

        // Ensure focus so the user can type immediately.
        this.#editorRef.value?.focus();
      }
      return;
    }

    // Copy / Cut — put raw template syntax on clipboard so chiclets
    // round-trip through paste.
    if ((evt.key === "c" || evt.key === "x") && isCtrlCommand) {
      evt.preventDefault();
      const range = this.#selection.getRange();
      if (range) {
        const startOffset = this.#selection.rangeToCharOffset(range);
        const endRange = range.cloneRange();
        endRange.collapse(false);
        const endOffset = this.#selection.rangeToCharOffset(endRange);

        // Extract raw value for the selected range.
        const rawText = this.#model.rawSlice(startOffset, endOffset);
        navigator.clipboard.writeText(rawText);

        if (evt.key === "x") {
          const newOffset = this.#model.deleteSelection(startOffset, endOffset);
          const afterChiclet = this.#model.hasChicletAtBoundary(newOffset);
          this.#syncFromModel(newOffset, afterChiclet, /* immediate */ true);
          this.#captureEditorValue();
        }
      }
      return;
    }

    // @ trigger for fast access.
    if (evt.key === "@") {
      this.#showFastAccessMenuOnKeyUp = true;
      // Anchor the history index before '@' is typed so addItem can
      // rewind past the '@' state.
      this.#flushPendingSnapshot();
      this.#fastAccessHistoryAnchor = this.#model.historyIndex;
    }

    // Cursor clamping around chiclets.
    this.#selection.ensureSafePosition(evt);
  }

  #onKeyUp(evt: KeyboardEvent): void {
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
  }

  // ---------------------------------------------------------------------------
  // Chiclet pointer-based reordering
  // ---------------------------------------------------------------------------

  #onChicletPointerDown(evt: PointerEvent, key: string): void {
    // Only primary button.
    if (evt.button !== 0) return;

    const chicletEl = evt.currentTarget;
    if (!(chicletEl instanceof HTMLElement)) return;

    // Prevent text selection while dragging.
    evt.preventDefault();

    // Keep focus on the editor so the caret remains visible.
    this.#editorRef.value?.focus();

    this.#dragSourceKey = key;
    chicletEl.classList.add("dragging");
    let didMove = false;
    let lastDropOffset = -1;

    const onPointerMove = (moveEvt: PointerEvent) => {
      didMove = true;
      // Update the caret position at the pointer for visual feedback.
      const caretPos = caretPositionFromPoint(
        moveEvt.clientX,
        moveEvt.clientY,
        this.renderRoot as ShadowRoot
      );
      if (!caretPos) return;

      // Skip if the caret lands inside the dragging chiclet itself.
      if (chicletEl === caretPos.node || chicletEl.contains(caretPos.node)) {
        return;
      }

      lastDropOffset = this.#selection.nodeToCharOffset(
        caretPos.node,
        caretPos.offset
      );

      // Use the shadow-DOM-aware cursor placement for visual feedback.
      this.#selection.setCursorAtCharOffset(lastDropOffset);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      chicletEl.classList.remove("dragging");

      if (!this.#dragSourceKey || !didMove || lastDropOffset === -1) {
        this.#dragSourceKey = null;
        return;
      }

      // Look up the source chiclet in render segments.
      const sourceRenderIndex = this.#renderSegments.findIndex(
        (_s, i) => `seg-${i}` === this.#dragSourceKey
      );
      this.#dragSourceKey = null;

      if (sourceRenderIndex === -1) return;
      const sourceSeg = this.#renderSegments[sourceRenderIndex];
      if (sourceSeg.kind !== "chiclet") return;

      // Find the chiclet in the model by its TemplatePart identity,
      // not by index mapping (which is unreliable due to synthetic
      // ZWNBSP segments in render output).
      const modelSourceIndex = this.#model.findSegmentByPart(sourceSeg.part);
      if (modelSourceIndex === -1) return;

      // Capture pre-drag state so undo restores cursor after the chiclet
      // in its original position.
      this.#flushPendingSnapshot();
      const chicletOffset = this.#model.chicletCharOffset(modelSourceIndex);
      this.#model.pushSnapshot(chicletOffset, true);

      // Remove and re-insert at the last valid drop position.
      this.#model.removeSegment(modelSourceIndex);
      this.#model.insertChicletAtOffset(lastDropOffset, sourceSeg.part);

      const afterChiclet = this.#model.hasChicletAtBoundary(lastDropOffset);
      this.#syncFromModel(lastDropOffset, afterChiclet, /* immediate */ true);
      this.#captureEditorValue();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // ---------------------------------------------------------------------------
  // Model ↔ DOM synchronization
  // ---------------------------------------------------------------------------

  /**
   * Rebuild render segments from the model and re-render.
   * If `cursorOffset` is provided, it will be restored in `updated()`
   * after Lit finishes rendering.
   */
  #syncFromModel(
    cursorOffset?: number,
    afterChiclet = false,
    immediate = false
  ): void {
    this.#renderSegments = this.#buildRenderSegments();
    if (cursorOffset !== undefined) {
      this.#pendingCursorOffset = cursorOffset;
      this.#pendingCursorAfterChiclet = afterChiclet;

      if (immediate) {
        // Flush any pending debounced snapshot first, then push immediately.
        this.#flushPendingSnapshot();
        this.#model.pushSnapshot(cursorOffset, afterChiclet);
      } else {
        // Debounce: capture snapshot data eagerly, push after 300ms pause.
        this.#pendingSnapshotData = this.#model.captureSnapshot(
          cursorOffset,
          afterChiclet
        );
        if (this.#snapshotTimer !== null) {
          clearTimeout(this.#snapshotTimer);
        }
        this.#snapshotTimer = setTimeout(() => {
          if (this.#pendingSnapshotData) {
            this.#model.pushPreparedSnapshot(this.#pendingSnapshotData);
            this.#pendingSnapshotData = null;
          }
          this.#snapshotTimer = null;
        }, 300);
      }
    }
    this.requestUpdate();
  }

  /** Flush any debounced snapshot that hasn't been pushed yet. */
  #flushPendingSnapshot(): void {
    if (this.#snapshotTimer !== null) {
      clearTimeout(this.#snapshotTimer);
      this.#snapshotTimer = null;
    }
    if (this.#pendingSnapshotData) {
      this.#model.pushPreparedSnapshot(this.#pendingSnapshotData);
      this.#pendingSnapshotData = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Value capture
  // ---------------------------------------------------------------------------

  #captureEditorValue(): void {
    const wasEmpty = this.#rawValue === "";
    this.#rawValue = this.#model.toRawValue();
    const isEmpty = this.#rawValue === "";

    // Re-render when the empty state changes so the placeholder toggles.
    if (wasEmpty !== isEmpty) {
      this.requestUpdate();
    }

    this.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Offset mapping
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Context menu
  // ---------------------------------------------------------------------------

  #onContextMenu(evt: Event): void {
    const isOnSelf = evt.composedPath().find((el) => el === this);
    if (!isOnSelf) return;
    evt.stopImmediatePropagation();
  }

  // ---------------------------------------------------------------------------
  // Global pointer handlers
  // ---------------------------------------------------------------------------

  #onGlobalPointerDown(): void {
    this.#hideFastAccess();
    this.#setFastAccessTarget(null);
  }

  #startTrackingSelections(evt: Event): void {
    this.#selection.clearChicletSelections();
    this.#selection.selectChicletIfPossible(evt);

    const [topItem] = evt.composedPath();
    if (!(topItem instanceof HTMLElement)) return;
    this.#shouldCheckSelections = topItem === this.#editorRef.value;
  }

  #stopTrackingSelections(evt: PointerEvent): void {
    if (!this.#shouldCheckSelections) {
      this.#triggerFastAccessIfOnStepParam();
      return;
    }
    this.#shouldCheckSelections = false;
    this.#checkSelectionsBound(evt);
  }

  #checkChicletSelections(evt: Event): void {
    if (!this.#shouldCheckSelections && evt.type !== "selectionchange") return;
    this.#selection.updateChicletSelections();
  }

  // ---------------------------------------------------------------------------
  // Fast access menu
  // ---------------------------------------------------------------------------

  #triggerFastAccessIfOnStepParam(targetChild?: ChildNode): void {
    if (!this.#editorRef.value) return;

    for (const child of this.#editorRef.value.childNodes) {
      if (!(child instanceof HTMLElement)) continue;

      if (targetChild) {
        if (child !== targetChild) continue;
        if (!child.classList.contains("selected")) {
          this.#selection.selectNode(child);
        }
      } else if (
        !child.classList.contains("chiclet") ||
        !child.classList.contains("selected")
      ) {
        continue;
      }

      if (!child.hasAttribute("data-parameter-step")) continue;

      this.storeLastRange();
      this.#setFastAccessTarget(this.#chicletToTemplatePart(child));
      this.#showFastAccess(child.getBoundingClientRect());
    }
  }

  /**
   * Look up the TemplatePart for a chiclet DOM element by finding its
   * segment key in the model, rather than re-parsing the DOM text content.
   */
  #chicletToTemplatePart(chiclet: HTMLElement): TemplatePart {
    const key = chiclet.dataset.segmentKey;
    if (key) {
      const entry = this.#renderSegments.find((_s, i) => `seg-${i}` === key);
      if (entry && entry.kind === "chiclet") {
        return entry.part;
      }
    }

    // Fallback: parse from DOM text (should not be needed with proper keys).
    try {
      const chicletValue = new Template(chiclet.textContent ?? "");
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

  // TODO: This positioning logic and mode state should migrate to
  // FastAccessController via SCA, keeping the component a thin shell.
  #showFastAccess(bounds: DOMRect | undefined): void {
    if (!bounds || !this.#fastAccessRef.value || !this.#proxyRef.value) return;

    const containerBounds = this.getBoundingClientRect();
    const proxyBounds = this.#proxyRef.value.getBoundingClientRect();
    let top = Math.round(bounds.top - proxyBounds.top);
    if (this.#fastAccessTarget !== null) {
      top += Math.round(bounds.height) + 4;
    }
    let left = Math.round(bounds.left - proxyBounds.left);

    if (left + 240 > proxyBounds.width) {
      left = proxyBounds.width - 240;
    }
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
      this.#fastAccessRef.value?.focusFilter();
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

  #hideFastAccess(): void {
    this.#isUsingFastAccess = false;
    if (this.sca) {
      this.sca.controller.editor.fastAccess.fastAccessMode = null;
    }
    this.#fastAccessRef.value?.classList.remove("active");
  }

  #setFastAccessTarget(part: TemplatePart | null): void {
    this.#fastAccessTarget = part;
    if (this.#fastAccessRef.value && this.#fastAccessTarget !== null) {
      this.#fastAccessRef.value.updateFilter("");
    }
  }
}
