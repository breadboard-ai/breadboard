/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import {
  DataParticle,
  GroupParticle,
  Particle,
  ParticleData,
  SerializedParticle,
  TextParticle,
} from "./types.js";

export {
  isParticle,
  toParticle,
  toSerializedParticle,
  isTextParticle,
  isDataParticle,
  isGroupParticle,
  extractValue,
};

function isParticle(o: unknown): o is Particle {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const p = o as Particle;
  return "text" in p || "data" in p || "group" in p;
}

function toParticle(serialized: SerializedParticle): Particle {
  return convert(serialized);

  function convert(serialized: SerializedParticle): Particle {
    if ("text" in serialized) return serialized;
    if ("data" in serialized) return serialized;
    if ("group" in serialized && Array.isArray(serialized.group)) {
      const group = new SignalMap<string, Particle>();
      for (const [key, value] of serialized.group) {
        group.set(key, convert(value));
      }
      return { ...serialized, group };
    }
    console.warn("Unrecognized serialized particle", serialized);
    return { text: "Unrecognized serialized particle" };
  }
}

function toSerializedParticle(particle: Particle): SerializedParticle {
  return convert(particle);

  function convert(particle: Particle): SerializedParticle {
    if ("text" in particle || "data" in particle) {
      return particle;
    }

    if ("group" in particle && particle.group instanceof Map) {
      const serializedGroup: [string, SerializedParticle][] = [];
      for (const [key, value] of particle.group.entries()) {
        serializedGroup.push([key, toSerializedParticle(value)]);
      }
      return { ...particle, group: serializedGroup };
    }

    console.warn("Unrecognized particle format", particle);
    return { text: "Unrecognized particle format" };
  }
}

function isTextParticle(p: Particle): p is TextParticle {
  return "text" in p;
}

function isDataParticle(p: Particle): p is DataParticle {
  return "data" in p;
}

function isGroupParticle(p: Particle): p is GroupParticle {
  return "group" in p;
}

function extractValue(p: Particle): ParticleData | null {
  if (isTextParticle(p)) {
    return p.text;
  } else if (isDataParticle(p)) {
    return p.data;
  }

  return null;
}
