/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, nothing, HTMLTemplateResult, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { intersects } from "./utils/rect-intersection";

@customElement("bb-graph-entity")
export class Entity extends LitElement {
  boundsLabel = "";
  entities = new Map<string, Entity>();

  @property()
  accessor bounds = new DOMRect();

  @property()
  accessor worldBounds: DOMRect | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showBounds = false;

  @property()
  accessor fixedSize = false;

  @property()
  accessor cullable = false;

  @property()
  accessor transform = new DOMMatrix();

  /**
   * Used when there is a transform delta applied. Holds the original position
   * data for the entity.
   */
  @property()
  accessor baseTransform: DOMMatrix | null = null;

  @property()
  accessor worldTransform = new DOMMatrix();

  @property({ reflect: true, type: Boolean })
  accessor hidden = false;

  @property({ reflect: true, type: Boolean })
  accessor selected = false;

  getLocalBounds() {
    return new DOMRect();
  }

  resetTransform() {
    this.transform = new DOMMatrix();
    this.baseTransform = null;
    this.worldTransform = new DOMMatrix();
  }

  updateEntity(matrix = new DOMMatrix()) {
    // The order here is super important.
    // 1. Send the most recent world transform down to the child entities.
    // 2. Calculate the local bounds (which may also adjust this entity's local
    //    transform).
    // 3. Apply the parent's matrix to the current entity *after* the bounds
    //    have been checked and any local transforms adjusted.
    const updatedTransform = matrix.multiply(this.transform);
    for (const entity of this.entities.values()) {
      entity.updateEntity(updatedTransform);
    }

    this.bounds = this.calculateLocalBounds();
    this.worldTransform = matrix.multiply(this.transform);
    this.worldBounds = this.calculateWorldBounds();
  }

  calculateLocalBounds() {
    return new DOMRect();
  }

  calculateWorldBounds() {
    const tl = new DOMPoint(this.bounds.left, this.bounds.top).matrixTransform(
      this.worldTransform
    );
    const tr = new DOMPoint(this.bounds.right, this.bounds.top).matrixTransform(
      this.worldTransform
    );
    const bl = new DOMPoint(
      this.bounds.left,
      this.bounds.bottom
    ).matrixTransform(this.worldTransform);

    return new DOMRect(tl.x, tl.y, tr.x - tl.x, bl.y - tl.y);
  }

  renderBounds() {
    if (!this.bounds || !this.showBounds) {
      return nothing;
    }

    const styles: Record<string, string> = {
      transform: `${toCSSMatrix(this.worldTransform)}`,
      width: `${this.bounds.width}px`,
      height: `${this.bounds.height}px`,
    };

    return html`<div id="bounds" style=${styleMap(styles)}><label>${
      this.boundsLabel === undefined
        ? "Unlabeled entity"
        : this.boundsLabel === ""
          ? "Main graph"
          : this.boundsLabel
    }</div>`;
  }

  cullOutsideOf(clipBounds: DOMRect, padding = 0) {
    this.hidden = false;

    if (!this.worldBounds) {
      return;
    }

    this.hidden =
      this.cullable && !intersects(this.worldBounds, clipBounds, padding);

    for (const entity of this.entities.values()) {
      entity.cullOutsideOf(clipBounds, padding);
    }
  }

  intersects(targetBounds: DOMRect, padding: number) {
    return intersects(this.worldBounds, targetBounds, padding);
  }

  selectInsideOf(
    bounds: DOMRect,
    padding = 0,
    isAdditiveSelection = false,
    isToggleSelection = false
  ) {
    if (!this.worldBounds) {
      this.selected = false;
      return;
    }

    const intersecting = this.intersects(bounds, padding);
    if (isToggleSelection && intersecting) {
      this.selected = !this.selected;
    } else if (isAdditiveSelection) {
      this.selected = this.selected || intersecting;
    } else if (!isAdditiveSelection && !isToggleSelection) {
      this.selected = intersecting;
    }

    for (const entity of this.entities.values()) {
      entity.selectInsideOf(
        bounds,
        padding,
        isAdditiveSelection,
        isToggleSelection
      );
    }
  }

  selectAt(
    bounds: DOMRect,
    padding = 0,
    isAdditiveSelection = false,
    isToggleSelection = false
  ) {
    if (!this.worldBounds) {
      this.selected = false;
      return;
    }

    const intersecting = this.intersects(bounds, padding);
    if (isToggleSelection && intersecting) {
      this.selected = !this.selected;
    } else if (isAdditiveSelection) {
      this.selected = this.selected || intersecting;
    } else if (!isAdditiveSelection && !isToggleSelection) {
      this.selected = intersecting;
    }

    if (!isAdditiveSelection && !isToggleSelection) {
      for (const entity of this.entities.values()) {
        entity.selected = false;
      }
    }

    const depthOrderedEntities = [...this.entities.values()]
      .reverse()
      .sort((e1, e2) => {
        const e1ZIndex = parseInt(window.getComputedStyle(e1).zIndex, 0);
        const e2ZIndex = parseInt(window.getComputedStyle(e2).zIndex, 0);

        return e2ZIndex - e1ZIndex;
      });

    for (const entity of depthOrderedEntities) {
      entity.selectAt(bounds, padding, isAdditiveSelection, isToggleSelection);

      if (entity.selected && !isAdditiveSelection && !isToggleSelection) {
        return;
      }
    }
  }

  adjustTranslation(x: number, y: number) {
    this.transform.translateSelf(x, y);

    if (this.baseTransform) {
      this.baseTransform.translateSelf(x, y);
    }
  }

  protected renderSelf(): HTMLTemplateResult | symbol {
    return nothing;
  }

  render():
    | Array<HTMLTemplateResult | symbol>
    | ReturnType<typeof html>
    | ReturnType<typeof svg>
    | symbol {
    return [
      this.renderSelf(),
      html`${repeat(this.entities.values(), (entity) => {
        entity.showBounds = this.showBounds;
        return html`${entity}`;
      })}`,
    ];
  }
}
