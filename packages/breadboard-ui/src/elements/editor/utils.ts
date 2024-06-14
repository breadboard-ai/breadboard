/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InspectableEdge } from "@google-labs/breadboard";

const documentStyles = getComputedStyle(document.documentElement);

export function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}

export function inspectableEdgeToString(edge: InspectableEdge): string {
  return `${edge.from.descriptor.id}:${edge.out}->${edge.to.descriptor.id}:${edge.in}`;
}

export function edgeToString(edge: {
  from: string;
  to: string;
  out: string;
  in: string;
}): string {
  const fakeEdge = {
    from: {
      descriptor: {
        id: edge.from,
      },
    },
    to: {
      descriptor: {
        id: edge.to,
      },
    },
    out: edge.out,
    in: edge.in,
  } as InspectableEdge;
  return inspectableEdgeToString(fakeEdge);
}

export const DBL_CLICK_DELTA = 450;
