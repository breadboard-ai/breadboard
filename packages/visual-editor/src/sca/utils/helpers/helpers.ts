/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, InspectableAssetEdge } from "@breadboard-ai/types";
import {
  AssetEdgeIdentifier,
  EdgeIdentifier,
  HydratedController,
} from "../../types.js";
import * as Formatter from "../logging/formatter.js";
import { getLogger } from "../logging/logger.js";
import { PENDING_HYDRATION } from "../sentinel.js";

export function toEdgeIdentifier(edge: Edge): EdgeIdentifier {
  const edgeIn = edge.out === "*" ? "*" : edge.in;
  return `${edge.from}:${edge.out}->${edge.to}:${edgeIn}`;
}

export function toAssetEdgeIdentifier(
  edge: InspectableAssetEdge
): AssetEdgeIdentifier {
  return `${edge.assetPath}->${edge.node.descriptor.id}:${edge.direction}`;
}

let ignoreHydrationErrors = false;

/**
 * Checks if a property decorated with @field is still loading from storage.
 *
 * There are a few ways this could go. In the first instance we will try and
 * call the accessor that we were provided. If this is the main usage then
 * trying to call the @field getter when the value is hydrating will trigger a
 * PendingHydrationError to be thrown.
 *
 * On the other hand it may be that we are access the underlying signal value
 * directly, as per the RootController checking for the subclass's hydration
 * status. In this case we will need to check whether the value of the signal
 * matches the PENDING_HYDRATION symbol.
 *
 * Finally, it could just be that the value has hydrated and therefore the
 * accessor runs without Error and the value is not the hydration symbol.
 */
export function isHydrating<T>(accessor: () => T): boolean {
  const restore = ignoreHydrationErrors;
  ignoreHydrationErrors = true;
  try {
    if (accessor.constructor.name === "AsyncFunction") {
      const logger = getLogger();
      logger.log(
        Formatter.warning("isHydrating accessors must be synchronous"),
        "Hydration Error"
      );
      throw new Error("isHydrating accessors must be synchronous");
    }
    const value = accessor();
    return value === PENDING_HYDRATION;
  } catch (err) {
    if (err instanceof PendingHydrationError) {
      return true;
    }

    throw err;
  } finally {
    ignoreHydrationErrors = restore;
  }
}

export function isHydratedController(
  value: unknown
): value is HydratedController {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  return "registerSignalHydration" in value;
}

export class PendingHydrationError extends Error {
  constructor(fieldName: string) {
    const msg = Formatter.error(
      `You are trying to access the field "${fieldName}" while it is still hydrating. ` +
        `Always check "if (isHydrating(() => obj.${fieldName}))" before using it.`
    );

    // Log immediately so it's visible even if the error is swallowed somewhere
    if (!ignoreHydrationErrors) {
      const logger = getLogger();
      logger.log(msg, "Hydration Error");
    }

    super(`PendingHydrationError on ${fieldName}`);
    this.name = "PendingHydrationError";
  }
}
