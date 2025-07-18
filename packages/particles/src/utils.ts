/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle, SerializedParticle } from "./types.js";

export { isParticle, toParticle };

function isParticle(o: unknown): o is Particle {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const p = o as Particle;
  return "text" in p || "data" in p || "group" in p;
}

function toParticle(
  serialized: SerializedParticle,
  mapFactory?: () => Map<string, Particle>
): Particle {
  return convert(serialized);

  function convert(serialized: SerializedParticle): Particle {
    if ("text" in serialized) return serialized;
    if ("data" in serialized) return serialized;
    if ("group" in serialized && Array.isArray(serialized.group)) {
      const group = mapFactory ? mapFactory() : new Map<string, Particle>();
      for (const [key, value] of serialized.group) {
        group.set(key, convert(value));
      }
      return { ...serialized, group };
    }
    console.warn("Unrecognized serialized particle", serialized);
    return { text: "Unrecognized serialized particle" };
  }
}
