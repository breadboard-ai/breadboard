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

export type SerializedGroupParticle = [
  key: string,
  value: SerializedParticle,
][];

export type JsonRpcNotification<Method extends string, Params> = {
  jsonrpc: "2.0";
  method: Method;
  params: Params;
};

export type ParticleAppendOperation = JsonRpcNotification<
  "suip/ops/append",
  {
    path: string[];
    particle: SerializedParticle;
  }
>;

export type ParticleInsertOperation = JsonRpcNotification<
  "suip/ops/insert",
  {
    path: string[];
    particle: SerializedParticle;
  }
>;

export type ParticleRemoveOperation = JsonRpcNotification<
  "suip/ops/remove",
  {
    path: string[];
  }
>;

export type ParticleReplaceOperation = JsonRpcNotification<
  "suip/ops/replace",
  {
    path: string[];
    particle: SerializedParticle;
  }
>;

export type ParticleOperation =
  | ParticleAppendOperation
  | ParticleInsertOperation
  | ParticleRemoveOperation
  | ParticleReplaceOperation;
