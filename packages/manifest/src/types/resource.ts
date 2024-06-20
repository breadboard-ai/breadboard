/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { BoardResource } from "./boards";
import { ManifestResource } from "./manifest";

export type ResourceReference = {
  title?: string;

  /**
   * @format uri-reference
   */
  url: string;
};

export type Resource = BoardResource | ManifestResource;
