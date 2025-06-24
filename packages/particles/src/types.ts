/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Hints = {
  /**
   * Provides presentation hints. If not specified, the group particle doesn't
   * have an opinion about its type (think "generic grouping").
   * If specified, can be used to identify semantics. For example, can be used
   * to bind to the right UI element.
   */
  presentation?: PresentationHint[];
  /**
   * Provides behavior hints. If not specified, the group particle is just
   * static content. Otherwise, the group particle has event listeners
   * (behaviors) attached to it.
   */
  behaviors?: BehaviorHint[];
};

export type TextParticle = {
  /**
   * Content of the particle.
   */
  text: string;
  /**
   * The type of the content. If omitted, "text/markdown" is assumed.
   */
  mimeType?: string;
} & Hints;

export type DataParticle = {
  /**
   * A URL that points to the data.
   */
  data: string;
  /**
   * The type of the data.
   */
  mimeType: string;
} & Hints;

export type GroupParticle = {
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
} & Hints;

export type PresentationHint = string;
export type BehaviorHint = string;

export type Particle = TextParticle | DataParticle | GroupParticle;

export type ParticleIdentifier = string;

/**
 * The basics of Semantic UI Protocol (SUIP)
 */

export type SerializedParticle =
  | TextParticle
  | DataParticle
  | SerializedGroupParticle;

export type SerializedGroupParticle = {
  type?: ParticleIdentifier;
  group: [key: string, value: SerializedParticle][];
};

export type JsonRpcNotification<Method extends string, Params> = {
  jsonrpc: "2.0";
  method: Method;
  params: Params;
};

/**
 * Append, Insert, or Replace operation:
 * - when the `path` and `id` match an existing particle, the existing particle
 *   will be replaced with provided particle.
 * - when the `path` and `id` do not match a particle and `before` isn't
 *   specified, the new particle will be appended.
 * - when the `path` and `id` do not match a particle and `before` matches id of
 *   an existing peer particle, new particle will be appended before the it.
 */
export type ParticleUpsertOperation = JsonRpcNotification<
  "suip/ops/upsert",
  {
    /**
     * Path to the parent of the newly added particle.
     */
    path: ParticleIdentifier[];
    /**
     * The id of the particle to add.
     */
    id: ParticleIdentifier;
    /**
     * The particle to add.
     */
    particle: SerializedParticle;
    /**
     * The peer particle id before which to insert the new particle.
     * If not specified or null, the particle will be appended at the end.
     */
    before?: ParticleIdentifier | null;
  }
>;

export type ParticleRemoveOperation = JsonRpcNotification<
  "suip/ops/remove",
  {
    path: ParticleIdentifier[];
  }
>;

export type ParticleOperation =
  | ParticleUpsertOperation
  | ParticleRemoveOperation;
