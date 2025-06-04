/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type TextParticle = {
  /**
   * Content of the particle.
   */
  text: string;
  /**
   * The type of the content. If omitted, "text/markdown" is assumed.
   */
  mimeType?: string;
};

export type DataParticle = {
  /**
   * A URL that points to the data.
   */
  data: string;
  /**
   * The type of the data.
   */
  mimeType: string;
};

type GroupParticle = {
  /**
   * The sub-particles that are part of this group.
   * The Map structure is key for reactive updates.
   */
  group: Map<ParticleIdentifier, Particle>;
  /**
   * The type of a group. Allows the particle to be bound to a particular
   * UI element. Optional. If not specified, the group particle doesn't have
   * an opinion about its type (think "generic grouping").
   * If specified, can be used to identify semantics. For example, can be used
   * to bind to the right custom element.
   */
  type?: string;
};

export type Particle = TextParticle | DataParticle | GroupParticle;

export type ParticleIdentifier = string;
