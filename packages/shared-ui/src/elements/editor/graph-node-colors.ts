/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphNodeColorScheme, GraphNodeIconName } from "./types";
import { getGlobalColor } from "./utils";

const purple: GraphNodeColorScheme = {
  background: getGlobalColor("--bb-generative-100"),
  mainBorder: getGlobalColor("--bb-generative-600"),
  headerBorder: getGlobalColor("--bb-generative-300"),
};

const green: GraphNodeColorScheme = {
  background: getGlobalColor("--bb-input-50"),
  mainBorder: getGlobalColor("--bb-input-600"),
  headerBorder: getGlobalColor("--bb-input-300"),
};

const blue: GraphNodeColorScheme = {
  background: getGlobalColor("--bb-ui-100"),
  mainBorder: getGlobalColor("--bb-ui-600"),
  headerBorder: getGlobalColor("--bb-ui-300"),
};

export const defaultColorScheme = { ...blue };

/**
 * This is a map of icon name to color scheme, not specifically the type of the
 * node in question. This is because nodes are mapped from URLs, which provide
 * a handler and other information but nothing categoric like the type. As such
 * the icon is generally a better indicator of the type.
 */
export const GraphNodeColors: Readonly<
  Map<GraphNodeIconName, GraphNodeColorScheme>
> = new Map([
  ["text", green],
  ["generative", purple],
  ["generative-image", purple],
  ["generative-text", purple],
  ["generative-audio", purple],
  ["combine-outputs", green],
  ["input", green],
  ["output", green],
]);
