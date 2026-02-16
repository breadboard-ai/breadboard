/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SCA } from "../sca.js";
import type { LiteModeType } from "../../ui/state/types.js";
import { Utils } from "../utils.js";

/**
 * Derives the current lite mode view type from SCA state.
 *
 * This is a pure function that computes the view type based on:
 * - Global viewError
 * - Global loadState
 * - Router parsedUrl
 * - FlowgenInput generation status
 * - Graph empty state
 *
 * @param sca - The SCA instance
 * @param isGraphEmpty - Whether the current graph has no nodes
 * @returns The computed LiteModeType
 */
export function deriveLiteViewType(
  sca: SCA,
  isGraphEmpty: boolean
): LiteModeType {
  const { controller } = sca;
  const { viewError, loadState } = controller.global.main;
  const { parsedUrl } = controller.router;
  const { state: flowgenState } = controller.global.flowgenInput;
  const isGenerating = flowgenState.status === "generating";

  if (viewError) return "error";

  switch (loadState) {
    case "Home": {
      if (parsedUrl.page === "home") {
        const zeroState = !!parsedUrl.new;
        if (zeroState) return "home";
      }
      // If the URL has a flow but loadState is still "Home", the load
      // action hasn't started yet - treat as "loading" rather than "invalid"
      if (parsedUrl.page === "graph" && parsedUrl.flow) {
        return "loading";
      }
      /* c8 ignore start */
      Utils.Logging.getLogger(sca.controller).log(
        Utils.Logging.Formatter.warning("Invalid Home URL state", parsedUrl),
        "deriveLiteViewType"
      );
      return "invalid";
      /* c8 ignore end */
    }
    case "Loading":
      if (isGenerating) {
        break;
      }
      return "loading";
    case "Error":
      return "error";
    case "Loaded": {
      break;
    }
    /* c8 ignore start */
    default:
      Utils.Logging.getLogger(sca.controller).log(
        Utils.Logging.Formatter.warning("Unknown UI load state", loadState),
        "deriveLiteViewType"
      );
      return "invalid";
    /* c8 ignore end */
  }

  // During flowgen generation the graph may be empty (nodes haven't been
  // created yet), but we still want to show the editor view so the user
  // sees the generation progress UI.
  if (isGraphEmpty && !isGenerating) return "home";
  return "editor";
}
