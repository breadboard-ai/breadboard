/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * # TextEditorRemix — Controlled Contenteditable Component
 *
 * ## Big Picture
 *
 * This is the Lit web component that renders the rich text editor. It displays
 * a mix of plain text and inline "chiclets" — UI pills representing template
 * parts (references to tools, files, steps, etc.).
 *
 * ## Architecture: Controlled Input
 *
 * Unlike a typical `contenteditable` where the browser mutates the DOM and
 * you read the result, this editor uses a **controlled input** pattern:
 *
 * 1. **`beforeinput` interception**: Every browser editing action is
 *    `preventDefault()`'d in `#onBeforeInput`.
 * 2. **Model mutation**: The corresponding operation is applied to the
 *    `EditorModel` (insert text, delete, etc.).
 * 3. **Re-render**: `#syncFromModel()` rebuilds render segments from the model
 *    and triggers a Lit update cycle.
 * 4. **Cursor restoration**: In `updated()`, the pending cursor offset is
 *    restored via `EditorSelection.setCursorAtCharOffset()`.
 *
 * This approach eliminates browser editing quirks (inconsistent line break
 * handling, unwanted formatting, contenteditable undo stack conflicts) and
 * gives us full control over the content structure.
 *
 * ## Key Subsystems
 *
 * - **EditorModel** (editor-model.ts): Pure data model — segment array,
 *   mutations, serialization, undo/redo history. No DOM dependencies.
 *
 * - **EditorSelection** (editor-selection.ts): DOM adapter — translates
 *   between the model's visible-text offsets and browser Range/Selection
 *   positions, handling ZWNBSP padding and shadow DOM quirks.
 *
 * - **This component**: Orchestration layer — wires user events to model
 *   mutations, manages the fast access menu (@-trigger), handles clipboard
 *   operations, and implements chiclet drag-and-drop reordering.
 *
 * ## Undo History Strategy
 *
 * Typing snapshots are **debounced**: each keystroke captures a snapshot
 * eagerly (so the segment state is correct) but defers pushing it to
 * history until 300ms of typing silence. This groups consecutive keystrokes
 * into a single undo step. Structural changes (chiclet insertion, paste,
 * drag, cut) push snapshots **immediately** because they represent discrete
 * user actions.
 *
 * ## Fast Access (@-trigger)
 *
 * When the user types '@', the component records a "history anchor" (the
 * undo index before the '@' was typed), shows the fast access menu, and
 * stores the cursor range. When a selection is made:
 * 1. History is truncated to the anchor (removing the '@' keystroke).
 * 2. The chiclet is inserted at the original cursor position.
 * 3. A fresh snapshot is pushed.
 * This makes undo skip from "pre-@" to "with-chiclet", never showing the
 * intermediate "@" state.
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
import { jsonStringify } from "../../../../utils/formatting/json-stringify.js";
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
  /** SCA singleton, consumed via Lit Context from a parent provider. */
  @consume({ context: scaContext })
  accessor sca!: SCA;

  /**
   * The raw template string value (with `{JSON}` chiclet syntax).
   *
   * The setter includes a bail-out guard: if the incoming value matches what
   * we already have, we skip the update. Without this, every parent re-render
   * would clobber in-progress edits, destroy/recreate all DOM nodes inside
   * the contenteditable (because render segment keys would regenerate), and
   * lose the user's cursor position.
   */
  @property()
  set value(value: string) {
    if (value === this.#rawValue) return;

    this.#rawValue = value;
    this.#model.replaceAll(value);
    this.#renderSegments = this.#buildRenderSegments();
    this.requestUpdate();
  }

  get value(): string {
    return this.#rawValue;
  }

  /** Always "string" — used by the form system to identify the input type. */
  get type(): string {
    return "string";
  }

  /** Whether the '@' key triggers the fast access menu. */
  @property({ reflect: true, type: Boolean })
  accessor supportsFastAccess = true;

  /** Sub-graph context for chiclet metadata resolution. */
  @property()
  accessor subGraphId: string | null = null;

  /** When true, the editor is non-editable (contenteditable=false). */
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

      /* The main editing surface. Uses break-spaces so whitespace and
         newlines render correctly without needing <br> elements. */
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

      /* Absolutely positioned placeholder that shows when the editor is empty.
         pointer-events: none ensures clicks pass through to the editor. */
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

      /* Chiclets are draggable (grab cursor) and fade when being dragged. */
      .chiclet {
        cursor: grab;

        &.dragging {
          opacity: 0.3;
        }
      }

      /* Fast access menu is hidden by default and positioned absolutely
         via CSS custom properties set from JS. */
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

      /* Zero-height proxy div at the top of the component, used as a
         coordinate reference for positioning the fast access menu.
         Its getBoundingClientRect() gives us the component's top-left
         in viewport coordinates. */
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

  /** The current serialized value (raw template string with {JSON} chiclets). */
  #rawValue = "";

  /** The pure data model — source of truth for all content. */
  #model = EditorModel.empty();

  /** DOM selection bridge — initialized in connectedCallback. */
  #selection!: EditorSelection;

  /** Cached render segments (model segments + ZWNBSP padding). */
  #renderSegments: Segment[] = [];

  /**
   * Pending cursor offset to restore after Lit re-renders the DOM.
   *
   * The controlled-input cycle is: mutate model → rebuild segments →
   * requestUpdate() → Lit reconciles DOM → `updated()` restores cursor.
   * These fields store the cursor position between the mutation and the
   * `updated()` callback.
   */
  #pendingCursorOffset: number | null = null;

  /** Whether the pending cursor should be placed after a chiclet. */
  #pendingCursorAfterChiclet = false;

  /** True while the fast access menu is open and capturing keyboard input. */
  #isUsingFastAccess = false;

  /**
   * Flag set on '@' keydown, consumed on keyup. We split across two events
   * because `beforeinput` fires between them — the '@' needs to be inserted
   * into the model first (via beforeinput), then the menu is shown on keyup
   * after the DOM has been updated with the '@' character.
   */
  #showFastAccessMenuOnKeyUp = false;

  /**
   * When non-null, the fast access menu is in "route" mode: the user has
   * selected a "Go to" step chiclet and is now picking a destination.
   * The target part is the existing step chiclet whose `instance` field
   * will be filled with the selected route.
   */
  #fastAccessTarget: TemplatePart | null = null;

  /** The last stored browser Range, used for restoring cursor on menu interactions. */
  #lastRange: Range | null = null;

  /** If focus() is called before the editor element exists, defer to firstUpdated. */
  #focusOnFirstRender = false;

  /** Guards selection-tracking: only check selections when pointer is in editor. */
  #shouldCheckSelections = false;

  // Drag state — tracks which chiclet is being dragged by its segment key.
  #dragSourceKey: string | null = null;

  // ---------------------------------------------------------------------------
  // Snapshot debounce for undo history
  // ---------------------------------------------------------------------------

  /**
   * Timer ID for the debounced snapshot push. Typing captures a snapshot
   * eagerly (at keystroke time) and stores it in #pendingSnapshotData,
   * but only pushes to history after 300ms of silence. This groups
   * consecutive keystrokes into a single undo step.
   */
  #snapshotTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The eagerly captured snapshot data waiting to be pushed.
   * We capture at keystroke time (so segment state is accurate) but
   * defer the push to coalesce rapid typing into one undo step.
   */
  #pendingSnapshotData: import("./editor-model.js").Snapshot | null = null;

  /**
   * History index captured before the '@' trigger keystroke. When a chiclet
   * is inserted via fast access, history is truncated to this anchor so
   * undo skips the intermediate '@' state.
   */
  #fastAccessHistoryAnchor: number | null = null;

  // Refs — Lit createRef() for type-safe access to rendered elements.
  #editorRef: Ref<HTMLSpanElement> = createRef();
  #proxyRef: Ref<HTMLDivElement> = createRef();
  #fastAccessRef: Ref<FastAccessMenu> = createRef();

  // Bound handlers — pre-bound so we can remove them in disconnectedCallback.
  #onGlobalPointerDownBound = this.#onGlobalPointerDown.bind(this);
  #startTrackingSelectionsBound = this.#startTrackingSelections.bind(this);
  #stopTrackingSelectionsBound = this.#stopTrackingSelections.bind(this);
  #checkSelectionsBound = this.#checkChicletSelections.bind(this);
  #onContextMenuBound = this.#onContextMenu.bind(this);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Set up the selection bridge and register global event listeners.
   *
   * Global listeners (on `window`) are necessary because:
   * - `selectionchange` only fires on `document`, not on individual elements.
   * - Pointer events during drag must be tracked globally (the pointer may
   *   leave the editor bounds).
   * - Context menu suppression needs capture phase on window.
   *
   * All listeners use `capture: true` where needed to intercept events
   * before they reach other handlers.
   */
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

  /** Clean up all global listeners to prevent memory leaks. */
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

  /** If focus was requested before the editor element existed, apply it now. */
  protected firstUpdated(): void {
    if (this.#focusOnFirstRender) {
      this.focus();
    }
  }

  /**
   * Restore cursor position after Lit finishes rendering.
   *
   * This is the final step of the controlled-input cycle. It runs
   * synchronously after the DOM update, before any pending event handlers
   * (e.g. keyup), ensuring storeLastRange captures the correct cursor
   * position for fast access.
   */
  protected override updated(): void {
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

  /** Save the current browser Range so it can be restored later. */
  storeLastRange(): void {
    this.#lastRange = this.#selection.getRange();
  }

  /**
   * Restore a previously stored range. Used when returning focus to the
   * editor after a fast access menu interaction.
   *
   * @param offsetLastChar When true, pulls the range back by one character
   *   (used to position the cursor just before the '@' trigger character
   *   so the chiclet replaces it).
   */
  restoreLastRange(offsetLastChar = true): void {
    if (!this.#lastRange || !this.#selection.isRangeValid(this.#lastRange)) {
      return;
    }

    this.focus();
    this.#selection.restoreRange(this.#lastRange, offsetLastChar);
  }

  /**
   * Insert a chiclet (template part) at the current cursor position.
   *
   * This is the main entry point for programmatic chiclet insertion,
   * called from the fast access menu selection handler and potentially
   * from external code.
   *
   * ### Undo history integration
   *
   * When inserting via fast access (triggered by '@'):
   * 1. Discard any pending debounced snapshot (the '@' keystroke).
   * 2. Truncate history to the pre-@ anchor.
   * 3. Push a fresh snapshot with the chiclet in place.
   *
   * This ensures undo jumps from "pre-@" directly to "with-chiclet",
   * never showing the intermediate "@" state.
   *
   * ### "Go to" step chaining
   *
   * If the inserted part is a "Go to" step (`ROUTE_TOOL_PATH`) without
   * a destination (`!part.instance`), the fast access menu is immediately
   * reopened in "route" mode so the user can pick a destination step.
   */
  async addItem(part: TemplatePart): Promise<void> {
    if (!this.#editorRef.value) return;

    // Ensure we have a valid cursor position.
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

    // If this is a "Go to" step without a destination, chain into route
    // selection by re-opening fast access in route mode.
    if (part.path === ROUTE_TOOL_PATH && !part.instance) {
      await this.updateComplete;
      this.#triggerFastAccessIfOnStepParam();
    }
  }

  /**
   * Focus the editor, placing the cursor at the end of all content.
   * If the editor element doesn't exist yet (pre-first-render), defer.
   */
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

  /** Delegate to the model's toRenderSegments() to get ZWNBSP-padded output. */
  #buildRenderSegments(): Segment[] {
    return this.#model.toRenderSegments();
  }

  /**
   * Render a single chiclet as a `<label>` element.
   *
   * Chiclets are rendered with `contenteditable="false"` so the browser
   * treats them as atomic inline elements — the cursor skips over them
   * rather than entering them. The `data-segment-key` attribute links
   * the DOM element back to its position in the render segments array,
   * enabling model lookups without parsing DOM text content.
   *
   * ### "Go to" step chiclets
   *
   * Route step chiclets (`ROUTE_TOOL_PATH`) have special rendering: they
   * show a source icon + title, a target icon + title (the destination),
   * and a dropdown arrow. The `data-parameter-step` attribute flags them
   * for the fast access route selection flow.
   *
   * ### Hidden preamble/postamble
   *
   * Each chiclet contains hidden `<span>` elements with the raw template
   * preamble (`{...`) and postamble (`...}`) so that if the DOM text is
   * read directly (e.g. for accessibility or clipboard fallback), it
   * produces valid template syntax.
   */
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

    // Build CSS class map for styling based on chiclet type/state.
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

    // Override title/icon for well-known tool paths.
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

    // For "Go to" steps with a destination, resolve the target's metadata.
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

    // Hidden template syntax spans for raw-text fallback.
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

  /** Top-level render: editor + fast access menu + coordinate proxy div. */
  render() {
    return html`
      ${this.#renderEditor()} ${this.#renderFastAccessMenu()}
      <div ${ref(this.#proxyRef)} id="proxy"></div>
    `;
  }

  /**
   * Render the main editor area.
   *
   * The content is a flat list of text strings and chiclet `<label>` elements
   * rendered as direct children of the `<span id="editor">`. Text segments
   * become text nodes; chiclet segments become rendered label elements.
   *
   * The `>${ ... }<` pattern (no whitespace between the tags and the template
   * expression) is intentional: it prevents Lit from inserting extra text
   * nodes that would break the 1:1 mapping between render segments and DOM
   * child nodes.
   */
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

  /**
   * Render the fast access menu.
   *
   * The `pointerdown` handler calls `stopImmediatePropagation()` to prevent
   * the global `#onGlobalPointerDown` handler from immediately hiding the
   * menu when the user clicks inside it.
   */
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

  /** Called when the user dismisses the fast access menu without selecting. */
  #onFastAccessDismissed() {
    this.#hideFastAccess();
    // Clear the history anchor — the '@' character stays in the text
    // since no chiclet was inserted.
    this.#fastAccessHistoryAnchor = null;
    this.#captureEditorValue();
    this.restoreLastRange();
    this.#setFastAccessTarget(null);
  }

  /**
   * Called when the user selects an item from the fast access menu.
   *
   * When `#fastAccessTarget` is set (route mode), the selected item fills
   * the target's `instance` field rather than creating a new chiclet.
   * Otherwise, a fresh chiclet is created from the selection event data.
   */
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

    // In route mode, merge the selection into the existing step chiclet.
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

  /**
   * Controlled input handler: intercepts ALL browser editing mutations.
   *
   * Every `beforeinput` event is `preventDefault()`'d so the browser never
   * mutates the DOM directly. Instead, the corresponding operation is
   * applied to the EditorModel, and Lit re-renders the result.
   *
   * ### Selection deletion
   *
   * If there's a non-collapsed selection (highlighted text), it's deleted
   * first via the model before the requested operation is applied. The
   * pre-delete state is snapshotted for undo, with the cursor at the
   * selection end so undo restores the cursor there.
   *
   * ### Cursor placement after deletion
   *
   * After a delete operation, if the cursor lands at a chiclet boundary,
   * it's placed **after** the chiclet. This keeps the cursor on the same
   * side as the deleted text — preventing the jarring experience of the
   * cursor jumping to the opposite side of a chiclet. For text insertion,
   * the cursor stays where the text was typed.
   */
  #onBeforeInput(evt: InputEvent): void {
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

    // Route each input type to the corresponding model operation.
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
        // Opt+Backspace: delete the previous word.
        const wordStart = this.#model.findWordBoundaryBefore(charOffset);
        newOffset = this.#model.deleteAtOffset(
          charOffset,
          wordStart - charOffset
        );
        break;
      }

      case "deleteWordForward": {
        // Opt+Delete: delete the next word.
        const wordEnd = this.#model.findWordBoundaryAfter(charOffset);
        newOffset = this.#model.deleteAtOffset(
          charOffset,
          wordEnd - charOffset
        );
        break;
      }

      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        // Cmd+Backspace: delete to start of line.
        newOffset = this.#model.deleteAtOffset(charOffset, -charOffset);
        break;

      case "deleteSoftLineForward":
      case "deleteHardLineForward": {
        // Cmd+Delete: delete to end of line.
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
   *
   * ### Why not just insert text?
   *
   * If we used `insertTextAtOffset`, pasted `{JSON}` would be treated as
   * literal text. Instead, we splice into the raw template string and
   * re-parse the entire model, which reconstitutes any chiclet syntax
   * in the pasted content.
   *
   * The cursor position after paste is computed from the pasted content's
   * visible text length (not raw length, since chiclets are zero-width).
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

    // Convert the visible-text cursor offset to a raw-string offset,
    // splice the pasted text in at that position, then re-parse.
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
    // Parse the pasted text as its own model to count visible characters
    // (which excludes chiclet JSON syntax).
    const pastedModel = EditorModel.fromRawValue(text);
    const newOffset = charOffset + pastedModel.visibleTextLength;
    const afterChiclet = this.#model.hasChicletAtBoundary(newOffset);

    this.#syncFromModel(newOffset, afterChiclet, /* immediate */ true);
    this.#captureEditorValue();
  }

  /**
   * Key-down handler for special keys that bypass the `beforeinput` pipeline.
   *
   * These keys either need pre-processing (Tab, @), custom behavior
   * (undo/redo, copy/cut), or cursor clamping around chiclets.
   */
  #onKeyDown(evt: KeyboardEvent): void {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    // Tab handling — route through model (not browser's native tab).
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

    // Undo / Redo — Cmd+Z / Cmd+Shift+Z.
    if (evt.key === "z" && isCtrlCommand) {
      evt.preventDefault();
      // Flush any pending debounced typing snapshot so it's undoable.
      this.#flushPendingSnapshot();
      const result = evt.shiftKey ? this.#model.redo() : this.#model.undo();
      if (result) {
        // Rebuild render segments but don't push a new snapshot
        // (undo/redo doesn't create new history entries).
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

        // Ensure focus so the user can type immediately after undo/redo.
        this.#editorRef.value?.focus();
      }
      return;
    }

    // Copy / Cut — put raw template syntax on clipboard so chiclets
    // round-trip through paste. We intercept these instead of letting
    // the browser's native clipboard handling run, because the browser
    // would copy the DOM's visual text (with ZWNBSPs) rather than the
    // raw template syntax we need for chiclet preservation.
    if ((evt.key === "c" || evt.key === "x") && isCtrlCommand) {
      evt.preventDefault();
      const range = this.#selection.getRange();
      if (range) {
        const startOffset = this.#selection.rangeToCharOffset(range);
        const endRange = range.cloneRange();
        endRange.collapse(false);
        const endOffset = this.#selection.rangeToCharOffset(endRange);

        // Extract raw value for the selected range (chiclets as {JSON}).
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

    // '@' trigger for fast access.
    if (evt.key === "@") {
      this.#showFastAccessMenuOnKeyUp = true;
      // Anchor the history index before '@' is typed so addItem can
      // rewind past the '@' state.
      this.#flushPendingSnapshot();
      this.#fastAccessHistoryAnchor = this.#model.historyIndex;
    }

    // Cursor clamping around chiclets — prevent cursor from landing
    // in the "danger zone" between ZWNBSPs and chiclets.
    this.#selection.ensureSafePosition(evt);
  }

  /**
   * Key-up handler — triggers the fast access menu after '@' is fully
   * processed (the '@' character has been inserted via beforeinput and
   * the DOM has been updated).
   */
  #onKeyUp(evt: KeyboardEvent): void {
    // If fast access is already open, swallow all keyups — they're
    // being handled by the menu.
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
  // Chiclet pointer-based reordering (drag-and-drop)
  // ---------------------------------------------------------------------------

  /**
   * Handle pointer-down on a chiclet to initiate drag reordering.
   *
   * This implements a lightweight drag system without the Drag & Drop API
   * (which doesn't work well with contenteditable and shadow DOM):
   *
   * 1. **pointerdown**: Record the source chiclet, add "dragging" class.
   * 2. **pointermove**: Use `caretPositionFromPoint` to find the text
   *    position under the pointer and show a caret there as visual feedback.
   * 3. **pointerup**: Remove the chiclet from its original position and
   *    re-insert it at the last valid drop offset.
   *
   * The source chiclet is looked up in the model by **TemplatePart reference
   * identity** (`findSegmentByPart`), not by index mapping, because the
   * render segments contain synthetic ZWNBSP text nodes that don't exist
   * in the model, making index mapping unreliable.
   */
  #onChicletPointerDown(evt: PointerEvent, key: string): void {
    // Only primary button (left-click).
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
      // Use caretPositionFromPoint to find where in the text the pointer is.
      const caretPos = caretPositionFromPoint(
        moveEvt.clientX,
        moveEvt.clientY,
        this.renderRoot as ShadowRoot
      );
      if (!caretPos) return;

      // Skip if the caret lands inside the dragging chiclet itself —
      // we can't drop a chiclet onto itself.
      if (chicletEl === caretPos.node || chicletEl.contains(caretPos.node)) {
        return;
      }

      lastDropOffset = this.#selection.nodeToCharOffset(
        caretPos.node,
        caretPos.offset
      );

      // Move the visible caret to the drop position for visual feedback.
      this.#selection.setCursorAtCharOffset(lastDropOffset);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      chicletEl.classList.remove("dragging");

      // Bail if the chiclet wasn't actually moved.
      if (!this.#dragSourceKey || !didMove || lastDropOffset === -1) {
        this.#dragSourceKey = null;
        return;
      }

      // Look up the source chiclet in render segments by its key.
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

      // Remove from original position and re-insert at drop position.
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
   * The core sync method: rebuild render segments from the model, schedule
   * cursor restoration, and trigger a Lit update.
   *
   * ### Snapshot debouncing
   *
   * When `immediate` is true (structural changes like chiclet insert, paste,
   * drag), a snapshot is pushed to history right away. When false (typing),
   * the snapshot is captured eagerly but pushed after a 300ms pause, grouping
   * consecutive keystrokes into a single undo step.
   *
   * The eager capture + deferred push pattern is important: we must clone
   * the segment state at keystroke time (when it's correct), but defer the
   * push to avoid bloating history with per-keystroke entries.
   *
   * @param cursorOffset Visible-text offset to restore after render.
   * @param afterChiclet Whether to place the cursor after a chiclet.
   * @param immediate If true, push snapshot immediately (structural changes).
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

  /**
   * Serialize the model to a raw value and dispatch an `input` event.
   *
   * This is the "output" side of the controlled-input cycle. After every
   * mutation, we read the model's raw value (the canonical representation)
   * and fire an `input` event so parent components can read the updated
   * `value` property.
   *
   * The placeholder visibility is tied to whether the value is empty,
   * so we trigger a re-render when the empty state changes.
   */
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
  // Context menu
  // ---------------------------------------------------------------------------

  /**
   * Suppress the browser's default context menu on the editor.
   * Uses `stopImmediatePropagation` to prevent other context menu handlers
   * (e.g. the app-level right-click menu) from interfering.
   */
  #onContextMenu(evt: Event): void {
    const isOnSelf = evt.composedPath().find((el) => el === this);
    if (!isOnSelf) return;
    evt.stopImmediatePropagation();
  }

  // ---------------------------------------------------------------------------
  // Global pointer handlers
  // ---------------------------------------------------------------------------

  /**
   * Any pointer-down anywhere in the window dismisses the fast access menu.
   * The menu's own pointerdown handler calls `stopImmediatePropagation()`
   * to prevent this from firing when clicking inside the menu.
   */
  #onGlobalPointerDown(): void {
    this.#hideFastAccess();
    this.#setFastAccessTarget(null);
  }

  /**
   * Start tracking pointer-based selections.
   *
   * Clears existing chiclet selections, and if the pointer landed on a
   * chiclet, toggles its selected state. Then flags whether the pointer
   * is inside the editor (for ongoing selection tracking during drag).
   */
  #startTrackingSelections(evt: Event): void {
    this.#selection.clearChicletSelections();
    this.#selection.selectChicletIfPossible(evt);

    const [topItem] = evt.composedPath();
    if (!(topItem instanceof HTMLElement)) return;
    this.#shouldCheckSelections = topItem === this.#editorRef.value;
  }

  /**
   * Stop tracking selections on pointer-up.
   *
   * If the pointer wasn't tracking editor selections (it was elsewhere),
   * check if the pointer-up landed on a selected step chiclet to trigger
   * the route fast access flow.
   */
  #stopTrackingSelections(evt: PointerEvent): void {
    if (!this.#shouldCheckSelections) {
      this.#triggerFastAccessIfOnStepParam();
      return;
    }
    this.#shouldCheckSelections = false;
    this.#checkSelectionsBound(evt);
  }

  /**
   * Update chiclet "selected" visual state during pointer drag and on
   * browser selection changes.
   */
  #checkChicletSelections(evt: Event): void {
    if (!this.#shouldCheckSelections && evt.type !== "selectionchange") return;
    this.#selection.updateChicletSelections();
  }

  // ---------------------------------------------------------------------------
  // Fast access menu
  // ---------------------------------------------------------------------------

  /**
   * If a selected chiclet is a "Go to" step, open the fast access menu
   * in route mode so the user can pick a destination.
   *
   * This is triggered after clicking a step chiclet, enabling a two-part
   * insertion flow: first pick "Go to", then pick the destination step.
   */
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
   * segment key in the render segments array.
   *
   * The primary path uses `data-segment-key` to find the chiclet in our
   * cached render segments — fast and reliable. The fallback path parses
   * the DOM text content as a Template, which should only be needed if
   * the keys somehow get out of sync (defensive coding).
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

  /**
   * Position and display the fast access menu near a DOM rect.
   *
   * ### Positioning strategy
   *
   * Uses the `#proxy` div as a coordinate reference — its `getBoundingClientRect()`
   * gives the component's top-left corner in viewport coordinates. The menu
   * is positioned relative to this origin using CSS custom properties
   * (`--fast-access-x`, `--fast-access-y`).
   *
   * Clamping logic prevents the menu from overflowing the component bounds:
   * - Right edge: clamp left so the 240px-wide menu stays within bounds.
   * - Bottom edge: clamp top so the 312px-tall menu stays within bounds.
   * - Zero bounds: fall back to (0, 0) for edge cases.
   *
   * In route mode, the menu is positioned below the chiclet (+ height + 4px gap).
   *
   * TODO: This positioning logic should migrate to FastAccessController via SCA.
   */
  // TODO: This positioning logic and mode state should migrate to
  // FastAccessController via SCA, keeping the component a thin shell.
  #showFastAccess(bounds: DOMRect | undefined): void {
    if (!bounds || !this.#fastAccessRef.value || !this.#proxyRef.value) return;

    const containerBounds = this.getBoundingClientRect();
    const proxyBounds = this.#proxyRef.value.getBoundingClientRect();
    let top = Math.round(bounds.top - proxyBounds.top);
    if (this.#fastAccessTarget !== null) {
      // In route mode, position below the chiclet with a small gap.
      top += Math.round(bounds.height) + 4;
    }
    let left = Math.round(bounds.left - proxyBounds.left);

    // Clamp to prevent overflow.
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

    // Set the menu mode: "route" when picking a step destination,
    // "browse" when inserting a new chiclet.
    const hasTarget = this.#fastAccessTarget !== null;
    this.#fastAccessRef.value.selectedIndex = 0;
    if (this.sca) {
      this.sca.controller.editor.fastAccess.fastAccessMode = hasTarget
        ? "route"
        : "browse";
    }
    this.#isUsingFastAccess = true;
  }

  /** Hide the fast access menu and reset its SCA mode. */
  #hideFastAccess(): void {
    this.#isUsingFastAccess = false;
    if (this.sca) {
      this.sca.controller.editor.fastAccess.fastAccessMode = null;
    }
    this.#fastAccessRef.value?.classList.remove("active");
  }

  /** Set (or clear) the fast access target and reset the menu filter. */
  #setFastAccessTarget(part: TemplatePart | null): void {
    this.#fastAccessTarget = part;
    if (this.#fastAccessRef.value && this.#fastAccessTarget !== null) {
      this.#fastAccessRef.value.updateFilter("");
    }
  }
}
