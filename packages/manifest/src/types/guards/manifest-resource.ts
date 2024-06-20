/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DereferencedManifest } from "../manifest";

export function isDereferencedManifest(
  resource: object
): resource is DereferencedManifest {
  return (
    typeof resource === "object" &&
    (hasBoardsArray(resource) || hasManifestsArray(resource))
  );
}

function hasManifestsArray(resource: object): boolean {
  return "manifests" in resource && Array.isArray(resource.manifests);
}

function hasBoardsArray(resource: object): boolean {
  return "boards" in resource && Array.isArray(resource.boards);
}
