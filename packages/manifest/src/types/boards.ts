/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { AdditionalProperties } from ".";
import { ResourceReference } from "./resource";

export type Node = AdditionalProperties & {};
export type Edge = AdditionalProperties & {};

export type ReferencedBoard = ResourceReference & {
  nodes?: undefined;
  edges?: undefined;
};

export type DereferencedBoard = {
  url?: undefined;
  nodes: Node[];
  edges: Edge[];
};

export type BoardResource = ReferencedBoard | DereferencedBoard;
