/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Field,
  GroupParticle,
  isDataParticle,
  isGroupParticle,
  Particle,
  Segment,
  SegmentType,
  SupportedTags,
} from "@breadboard-ai/particles";
import { ParticleTemplate } from "./types/types";

/**
 * Collects the particles across all groups by their presentation name, e.g.,
 * hero-image, body-copy etc.
 *
 * @param src The particle at which to start
 * @param particlesByPresentation The target Map for collecting values.
 */
function collectParticlesByPresentation(
  src: Particle,
  particlesByPresentation: Map<string, Particle[]>
) {
  if (isGroupParticle(src)) {
    for (const item of src.group.values()) {
      collectParticlesByPresentation(item, particlesByPresentation);
    }
  }

  if (typeof src.presentation === "string") {
    let particles = particlesByPresentation.get(src.presentation);
    if (!particles) {
      particles = [];
      particlesByPresentation.set(src.presentation, particles);
    }

    delete src.presentation;
    particles.push(src);
  }
}

/**
 * When a segment / field is expanded within a particle it is possible that it
 * will match several items with that presentation. When that obtains we swap
 * out all instances with fresh fields, each of which requiring a new ID. This
 * function creates that ID.
 *
 * @returns A new ID.
 */
function newId() {
  return globalThis.crypto.randomUUID();
}

/**
 * Attempts to map a Particle to the rendering type. Generally used with the
 * extraneous (`*`) block, i.e., the catch-all zone in a template.
 *
 * @param particle A Particle to classify.
 * @returns The tag and type.
 */
function guesstimateParticleType(particle: Particle): {
  as: SupportedTags;
  type: SegmentType;
} {
  if (isDataParticle(particle)) {
    if (particle.mimeType.startsWith("image")) {
      return { as: "particle-viewer-image", type: "media" };
    } else if (particle.mimeType.startsWith("video")) {
      return { as: "particle-viewer-video", type: "media" };
    } else if (particle.mimeType.startsWith("audio")) {
      return { as: "particle-viewer-audio", type: "media" };
    }
  }

  return { as: "particle-viewer-text", type: "block" };
}

/**
 * When items are provided that don't match to the template we can optionally
 * collect them here.
 *
 * @param extraneous The target array onto which we will add the Particles.
 * @param particles The particles to add to the array.
 */
function pushToExtraneous(extraneous: GroupParticle, particles: Particle[]) {
  for (const particle of particles) {
    if (isGroupParticle(particle)) {
      continue;
    }

    const id = newId();
    const { as, type } = guesstimateParticleType(particle);
    particle.presentation = {
      type: "card",
      behaviors: [],
      orientation: "vertical",
      segments: [
        {
          fields: {
            [id]: {
              as,
              title: "Unknown",
            },
          },
          weight: 1,
          orientation: "vertical",
          type,
        },
      ],
    };

    extraneous.group.set(id, particle);
    extraneous.presentation = {
      type: "list",
      behaviors: [],
      orientation: "vertical",
    };
  }
}

/**
 * This is the workhorse function used to expand on the template provided and to
 * map in all the particles to be presented from the data set.
 *
 * @param particleTemplate The Particle Template to expand.
 * @param particlesByPresentation The Particles to place grouped by
 *   presentation type.
 * @param presentationsUsed An internal tracker for which types have been
 *   placed.
 * @param extraneous An internal tracker for any extraneous items, i.e., items
 *   that were provided but which we couldn't place.
 * @param output The outputted Group Particle.
 * @returns A Group Particle for rendering.
 */
function mapTemplateToGroupParticle(
  particleTemplate: ParticleTemplate,
  particlesByPresentation: Map<string, Particle[]>,
  presentationsUsed: Set<string>,
  extraneous: GroupParticle,
  output: GroupParticle
) {
  // Recursively work down any groups expanding on each item found. Notably
  // because this is going depth first if a child happens to take a particular
  // rendering group, e.g., hero-image, then it wouldn't be available to any
  // ancestor.
  if (particleTemplate.group) {
    for (const [id, item] of particleTemplate.group) {
      const subGroup = mapTemplateToGroupParticle(
        item,
        particlesByPresentation,
        presentationsUsed,
        extraneous,
        {
          group: new Map(),
        }
      );

      if (!subGroup) {
        continue;
      }

      output.group.set(id, subGroup);
    }
  }

  // If the item has no segments then it is of type: 'list', which means we just
  // copy in the presentation and return it as-is.
  if (!particleTemplate.presentation.segments) {
    output.presentation = {
      ...particleTemplate.presentation,
    };
    return output;
  }

  // For everything else we will now create the appropriate items, which are
  // usually cards.
  const particlesForGroup = new Map<string, Particle>();
  const populatedSegments: Segment[] = [];

  // Step through the template's segments.
  for (const tmplSegment of particleTemplate.presentation.segments) {
    const segmentFields: Record<string, Field> = {};
    const segment: Segment = { ...tmplSegment, fields: segmentFields };
    const tmplSegmentFields = Object.entries(tmplSegment.fields);

    // Locate any particles of the correct type. For example, in the Particle
    // Template we may have encountered `hero-image` so we go an locate the
    // Particles with that rendering type.
    for (const [particleType, field] of tmplSegmentFields) {
      const particlesToPresent =
        particlesByPresentation.get(particleType) ?? [];
      presentationsUsed.add(particleType);

      // If the field indicates that we only want a subset of the items we take
      // the ones indicated and push the rest to the extraneous group.
      let particles;
      if (field.take) {
        particles = particlesToPresent.slice(0, field.take);
        pushToExtraneous(extraneous, particlesToPresent.slice(field.take));
      } else {
        particles = particlesToPresent;
      }

      // Here we are doing an expansion because it's possible we will have
      // multiple entries from the template, so we now have to create a new ID
      // for each item that we found, set it on the segments, and then update
      // the group to have the new Particle.
      for (const particle of particles) {
        const id = newId();
        segmentFields[id] = field;
        particlesForGroup.set(id, particle);
      }
    }

    populatedSegments.push(segment);
  }

  const dstPresentation = {
    ...particleTemplate.presentation,
    segments: populatedSegments,
  };

  output.group = particlesForGroup;
  output.presentation = dstPresentation;

  return output;
}

/**
 * Takes an unadorned GroupParticle and a ParticleTemplate and returns an
 * adorned GroupParticle with the contents from the unadorned GroupParticle
 * distributed to the locations indicated by the template.
 *
 * @param src The unadorned GroupParticle.
 * @param template The ParticleTemplate to use.
 * @returns An adorned GroupParticle.
 */
export function resolve(
  src: GroupParticle,
  template: ParticleTemplate
): GroupParticle {
  const presentationsUsed = new Set<string>();
  const particlesByPresentation = new Map<string, Particle[]>();
  const extraneous = { group: new Map<string, Particle>() };

  // Collect all the presentation types in use.
  collectParticlesByPresentation(src, particlesByPresentation);

  // Now do the mapping work.
  const resolved = mapTemplateToGroupParticle(
    template,
    particlesByPresentation,
    presentationsUsed,
    extraneous,
    {
      group: new Map(),
    }
  );

  // Any collected presentation types that weren't consumed get pushed to the
  // extraneous bin.
  for (const [particleType, particles] of particlesByPresentation) {
    if (presentationsUsed.has(particleType)) {
      continue;
    }

    pushToExtraneous(extraneous, particles);
  }

  if (!resolved) {
    console.warn("Unable to resolve");
    return { group: new Map() };
  }

  // If the template has an extraneous bucket (a group named `*`) then we drop
  // all the additional items that we found into it.
  if (template.group) {
    const templateHasExtraneous = template.group.findIndex((t) => t[0] === "*");
    if (extraneous.group.size > 0 && templateHasExtraneous !== -1) {
      resolved.group.set("*", extraneous);
    }
  }

  return resolved;
}
