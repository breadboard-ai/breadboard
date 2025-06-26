/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataParticle,
  Field,
  Particle,
  Presentation,
} from "@breadboard-ai/particles";

export { decorateParticle };

/**
 * Recursively decorates provided Particle with Presentations.
 * If Presentation is not found or assigned, makes best-effort guess
 * on how to decorate the particle.
 *
 * @param original - the particle to decorate.
 * @param presentations -
 * @returns
 */
function decorateParticle(
  original: Particle,
  presentations: Map<string, Presentation>
): Particle {
  // Make a shallow copy, so that we can change object properties as we recurse.
  const particle = { ...original };
  if (typeof particle.presentation === "string") {
    particle.presentation = presentations.get(particle.presentation);
  }
  if (!particle.presentation) {
    // TODO: Make best-effort guess to assign presentation
    particle.presentation = inferPresentation(particle);
  }
  if ("group" in particle) {
    // Recurse into sub-particles
    particle.group = new Map(
      [...particle.group.entries()].map(([key, particle]) => [
        key,
        decorateParticle(particle, presentations),
      ])
    );
  }
  return particle;
}

function inferPresentation(particle: Particle): Presentation | null {
  switch (true) {
    case "text" in particle:
      return textParticlePresentation();
    case "data" in particle:
      return dataParticlePresentation(particle);
  }
  return null;
}

function dataParticlePresentation(particle: DataParticle): Presentation {
  const asType = as(particle.mimeType);
  return {
    behaviors: [],
    type: "card",
    segments: [
      {
        weight: 1,
        type: "media",
        fields: {
          src: {
            title: "Generated Item",
            as: asType,
            src: particle.data,
          },
        },
        orientation: "vertical",
      },
    ],
    orientation: "vertical",
  };
}

function textParticlePresentation(): Presentation {
  return {
    behaviors: [],
    type: "card",
    segments: [
      {
        weight: 1,
        type: "block",
        fields: {
          text: {
            title: "Text part",
            modifiers: [],
            as: "particle-ui-text",
          },
        },
        orientation: "vertical",
      },
    ],
    orientation: "vertical",
  };
}

function as(mimeType: string, isStored = false): Field["as"] {
  const mimePrefix = mimeType.split("/").at(0);

  switch (mimePrefix) {
    case "audio":
      return "particle-ui-audio";
    case "video":
      return "particle-ui-video";
    case "image":
      return "particle-ui-image";
    case "text":
      if (mimeType === "text/plain") {
        return "particle-ui-code";
      }
      return isStored ? "particle-ui-file" : "particle-ui-text";
    default:
      return "particle-ui-file";
  }
}
