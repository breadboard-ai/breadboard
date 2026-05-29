/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeIdentifier } from "@breadboard-ai/types";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export type { Viewport, StepDimensions };

interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface StepDimensions {
  width: number;
  height: number;
}

export class CanvasController extends RootController {
  @field({ deep: true })
  private accessor _viewport: Viewport = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  @field({ deep: true })
  private accessor _stepDimensions: Map<NodeIdentifier, StepDimensions> = new Map();

  @field({ deep: true })
  private accessor _assetDimensions: Map<string, StepDimensions> = new Map();

  @field()
  private accessor _fitToViewTrigger: number = 0;

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  get fitToViewTrigger(): number {
    return this._fitToViewTrigger;
  }

  requestFitToView(): void {
    this._fitToViewTrigger++;
  }

  get viewport(): Readonly<Viewport> {
    return this._viewport;
  }

  setViewport(viewport: Viewport): void {
    this._viewport = viewport;
  }

  getStepDimensions(nodeId: NodeIdentifier): Readonly<StepDimensions> {
    return this._stepDimensions.get(nodeId) || { width: 300, height: 0 };
  }

  setStepDimensions(nodeId: NodeIdentifier, dimensions: StepDimensions): void {
    this._stepDimensions.set(nodeId, dimensions);
  }

  getAssetDimensions(assetPath: string): Readonly<StepDimensions> {
    return this._assetDimensions.get(assetPath) || { width: 300, height: 0 };
  }

  setAssetDimensions(assetPath: string, dimensions: StepDimensions): void {
    this._assetDimensions.set(assetPath, dimensions);
  }

  get stepDimensions(): ReadonlyMap<NodeIdentifier, StepDimensions> {
    return this._stepDimensions;
  }

  get assetDimensions(): ReadonlyMap<string, StepDimensions> {
    return this._assetDimensions;
  }

  clearStepDimensions(): void {
    this._stepDimensions.clear();
  }

  removeStepDimensions(nodeId: NodeIdentifier): void {
    this._stepDimensions.delete(nodeId);
  }
}
