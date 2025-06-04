/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle } from "./types.js";

export { isParticle };

function isParticle(o: unknown): o is Particle {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const p = o as Particle;
  return "text" in p || "data" in p || "group" in p;
}
