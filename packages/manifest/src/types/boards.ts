/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { AdditionalProperties } from ".";
import { ResourceReference, Title, UriReference } from "./resource";

/**
 * Minimal node type
 */
export type Node = AdditionalProperties & {};

/**
 * Minimal edge type
 */
export type Edge = AdditionalProperties & {};

/**
 * A reference to a board resource.
 * @examples [
 * {
 *  "title": "My Awesom Board",
 *  "url": "https://breadboard.new/board.bgl.json"
 * },{
 *  "url": "board.bgl.json"
 * },{
 *  "url": "./boards/board.bgl.json"
 * }
 * ]
 */
export type ReferencedBoard = ResourceReference & {
  nodes?: undefined;
  edges?: undefined;
};

/**
 * A dereferenced board with nodes and edges.
 * @examples [{ "nodes": [], "edges": [] }]
 */
export type DereferencedBoard = {
  url?: UriReference;
  title?: Title;
  nodes: Node[];
  edges: Edge[];
};

/**
 * A board resource.
 * Either referenced or dereferenced.
 * @examples [
 * { "nodes": [], "edges": [] },
 * { "url": "https://breadboard.new/board.bgl.json" }
 * ]
 */
export type BoardResource = ReferencedBoard | DereferencedBoard;
